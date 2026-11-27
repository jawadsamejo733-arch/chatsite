<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/** Phone-number login with one-time SMS codes, PHP sessions and CSRF tokens. */
final class Auth
{
    private static ?array $user = null;

    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $lifetime = max(1, (int)cfg('session_days', 30)) * 86400;
        $dir = storage_path('sessions');
        if (is_dir($dir) || @mkdir($dir, 0700, true)) {
            if (is_writable($dir)) {
                session_save_path($dir);
                ini_set('session.gc_probability', '1');
                ini_set('session.gc_divisor', '200');
            }
        }
        ini_set('session.gc_maxlifetime', (string)$lifetime);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name('chatsite_sid');
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => base_path(),
            'secure' => is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = random_hex(32);
        }
    }

    public static function csrfToken(): string
    {
        return (string)($_SESSION['csrf'] ?? '');
    }

    public static function checkCsrf(): void
    {
        $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if ($sent === '' || !hash_equals(self::csrfToken(), $sent)) {
            throw new ApiError('Your session expired. Please reload the page.', 403, ['code' => 'csrf']);
        }
    }

    public static function userId(): ?int
    {
        $id = $_SESSION['uid'] ?? null;
        return is_int($id) ? $id : null;
    }

    public static function user(): ?array
    {
        if (self::$user === null && ($id = self::userId())) {
            self::$user = Db::one('SELECT * FROM users WHERE id = ?', [$id]);
            if (self::$user === null) {
                unset($_SESSION['uid']);
            }
        }
        return self::$user;
    }

    public static function requireUser(): array
    {
        $u = self::user();
        if (!$u) {
            throw new ApiError('Please sign in.', 401);
        }
        return $u;
    }

    private static function codeHash(string $phone, string $code): string
    {
        return hmac('otp|' . $phone . '|' . $code);
    }

    public static function requestCode(string $rawPhone): array
    {
        $phone = normalize_phone($rawPhone);
        if ($phone === null) {
            throw new ApiError('Enter a valid mobile number including the country code.');
        }
        $now = time();
        $ip = client_ip();
        $otp = (array)cfg('otp');

        $last = Db::one('SELECT created_at FROM otp_codes WHERE phone = ? ORDER BY id DESC LIMIT 1', [$phone]);
        $wait = $last ? (int)$last['created_at'] + (int)$otp['resend_after'] - $now : 0;
        if ($wait > 0) {
            throw new ApiError("Please wait {$wait} seconds before requesting another code.", 429, ['retry_after' => $wait]);
        }
        $perPhone = (int)Db::value('SELECT COUNT(*) FROM otp_codes WHERE phone = ? AND created_at > ?', [$phone, $now - 3600]);
        $perIp = (int)Db::value('SELECT COUNT(*) FROM otp_codes WHERE ip = ? AND created_at > ?', [$ip, $now - 3600]);
        if ($perPhone >= (int)$otp['per_phone_hour'] || $perIp >= (int)$otp['per_ip_hour']) {
            throw new ApiError('Too many codes requested. Please try again in an hour.', 429);
        }

        $testNumbers = (array)cfg('test_numbers', []);
        $isTest = isset($testNumbers[$phone]);
        $code = $isTest ? (string)$testNumbers[$phone] : sprintf('%06d', random_int(0, 999999));

        Db::run('UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0', [$phone]);
        $id = Db::insert(
            'INSERT INTO otp_codes (phone, code_hash, ip, attempts, used, created_at, expires_at) VALUES (?, ?, ?, 0, 0, ?, ?)',
            [$phone, self::codeHash($phone, $code), $ip, $now, $now + (int)$otp['ttl']]
        );

        if (!$isTest) {
            $minutes = max(1, intdiv((int)$otp['ttl'], 60));
            $text = "{$code} is your " . cfg('app_name') . " login code. It expires in {$minutes} minutes. Don't share it with anyone.";
            try {
                Sms::send($phone, $text);
            } catch (Throwable $e) {
                Db::run('DELETE FROM otp_codes WHERE id = ?', [$id]);
                log_line('error.log', 'SMS failed for ' . $phone . ': ' . $e->getMessage());
                throw new ApiError('We could not send the SMS right now. Please try again shortly.', 502);
            }
        }

        if (random_int(1, 25) === 1) {
            Db::run('DELETE FROM otp_codes WHERE created_at < ?', [$now - 86400]);
        }

        $result = ['phone' => $phone, 'resend_after' => (int)$otp['resend_after']];
        if (is_dev() && cfg('sms.driver') === 'log') {
            $result['dev_code'] = $code;   // shown on screen in development so you can test without SMS
        }
        return $result;
    }

    public static function verifyCode(string $rawPhone, string $code): array
    {
        $phone = normalize_phone($rawPhone);
        $code = preg_replace('/\D+/', '', $code);
        if ($phone === null || strlen((string)$code) !== 6) {
            throw new ApiError('Enter the 6-digit code we sent you.');
        }
        $now = time();
        $row = Db::one(
            'SELECT * FROM otp_codes WHERE phone = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1',
            [$phone, $now]
        );
        if (!$row) {
            throw new ApiError('That code has expired. Request a new one.', 400);
        }
        $max = (int)cfg('otp.max_attempts', 5);
        if ((int)$row['attempts'] >= $max) {
            throw new ApiError('Too many wrong attempts. Request a new code.', 429);
        }
        if (!hash_equals((string)$row['code_hash'], self::codeHash($phone, (string)$code))) {
            Db::run('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
            $left = $max - (int)$row['attempts'] - 1;
            throw new ApiError($left > 0 ? "Wrong code. {$left} attempt" . ($left === 1 ? '' : 's') . ' left.' : 'Too many wrong attempts. Request a new code.', $left > 0 ? 400 : 429);
        }
        Db::run('UPDATE otp_codes SET used = 1 WHERE id = ?', [$row['id']]);

        $user = Db::one('SELECT * FROM users WHERE phone = ?', [$phone]);
        if (!$user) {
            try {
                $id = Db::insert('INSERT INTO users (phone, created_at, last_seen_at) VALUES (?, ?, ?)', [$phone, $now, $now]);
            } catch (Throwable $e) {
                if (!Db::isUniqueViolation($e)) {
                    throw $e;
                }
                $id = (int)Db::value('SELECT id FROM users WHERE phone = ?', [$phone]);
            }
            $user = Db::one('SELECT * FROM users WHERE id = ?', [$id]);
        }

        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$user['id'];
        $_SESSION['csrf'] = random_hex(32);
        self::$user = $user;
        return $user;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'],
                'httponly' => true, 'samesite' => 'Lax',
            ]);
        }
        session_destroy();
    }
}
