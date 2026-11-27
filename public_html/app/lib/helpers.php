<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/** Thrown by handlers to return a clean JSON error to the browser. */
final class ApiError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400, public array $extra = [])
    {
        parent::__construct($message);
    }
}

function default_config(): array
{
    return [
        'installed' => true,
        'app_name' => 'ChatSite',
        'env' => 'production',            // 'production' or 'development'
        'app_secret' => '',
        'db' => ['dsn' => '', 'user' => '', 'pass' => ''],
        'storage_dir' => PUBLIC_DIR . '/storage',
        'auto_migrate' => false,
        'default_country_code' => '1',
        'session_days' => 30,
        'sms' => [
            'driver' => 'log',            // log | twilio | http
            'twilio' => ['sid' => '', 'token' => '', 'from' => '', 'messaging_service_sid' => ''],
            'http' => [
                'url' => '', 'method' => 'POST', 'json' => false, 'headers' => [],
                'params' => ['to' => '{phone}', 'message' => '{message}'],
            ],
        ],
        // Fixed codes for review/demo numbers, e.g. ['+15550001111' => '424242']. No SMS is sent.
        'test_numbers' => [],
        'otp' => ['ttl' => 600, 'max_attempts' => 5, 'resend_after' => 45, 'per_phone_hour' => 5, 'per_ip_hour' => 20],
        'limits' => [
            'message_length' => 4000,
            'messages_per_minute' => 40,
            'custom_upload_mb' => 10,
            'custom_unpacked_mb' => 30,
            'custom_files' => 300,
            'paste_kb' => 1500,
            'image_mb' => 4,          // photos on template mini-sites
            'media_files' => 200,
            'photo_mb' => 10,         // photos sent in chats
            'file_mb' => 15,          // videos, voice messages and documents (keep below upload_max_filesize)
        ],
    ];
}

function dev_config(): array
{
    $storage = getenv('CHATSITE_STORAGE') ?: PUBLIC_DIR . '/storage';
    if (!is_dir($storage)) {
        mkdir($storage, 0775, true);
    }
    $secretFile = $storage . '/dev_secret';
    if (!is_file($secretFile)) {
        file_put_contents($secretFile, bin2hex(random_bytes(32)));
    }
    return [
        'env' => 'development',
        'app_secret' => trim((string)file_get_contents($secretFile)),
        'storage_dir' => $storage,
        'auto_migrate' => true,
        'db' => [
            'dsn' => getenv('CHATSITE_DB_DSN') ?: 'sqlite:' . $storage . '/dev.sqlite',
            'user' => getenv('CHATSITE_DB_USER') ?: '',
            'pass' => getenv('CHATSITE_DB_PASS') ?: '',
        ],
        'default_country_code' => getenv('CHATSITE_COUNTRY_CODE') ?: '1',
        'test_numbers' => ['+15550000001' => '111111', '+15550000002' => '222222'],
        'otp' => ['per_ip_hour' => 1000],   // everyone is 127.0.0.1 locally
    ];
}

function load_config(): array
{
    $defaults = default_config();
    $file = APP_DIR . '/config.php';
    if (is_file($file)) {
        $c = require $file;
        return array_replace_recursive($defaults, is_array($c) ? $c : []);
    }
    if (PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli') {
        return array_replace_recursive($defaults, dev_config());
    }
    return array_replace_recursive($defaults, ['installed' => false]);
}

function cfg(string $path, mixed $default = null): mixed
{
    $v = $GLOBALS['CHATSITE_CONFIG'] ?? [];
    foreach (explode('.', $path) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) {
            return $default;
        }
        $v = $v[$k];
    }
    return $v;
}

function is_dev(): bool
{
    return cfg('env') !== 'production';
}

function storage_path(string $rel = ''): string
{
    return rtrim((string)cfg('storage_dir'), '/') . ($rel === '' ? '' : '/' . ltrim($rel, '/'));
}

function ensure_dir(string $dir): string
{
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Cannot create directory: ' . $dir);
    }
    return $dir;
}

function log_line(string $file, string $line): void
{
    try {
        $dir = ensure_dir(storage_path('logs'));
        @file_put_contents($dir . '/' . $file, '[' . gmdate('Y-m-d H:i:s') . '] ' . $line . "\n", FILE_APPEND | LOCK_EX);
    } catch (Throwable) {
        error_log('[chatsite] ' . $line);
    }
}

function e(mixed $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function str_length(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int)preg_match_all('/./us', $s);
}

function str_cut(string $s, int $max): string
{
    if (str_length($s) <= $max) {
        return $s;
    }
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max, 'UTF-8');
    }
    preg_match('/^.{0,' . $max . '}/us', $s, $m);
    return $m[0] ?? '';
}

/** Trim, drop invalid UTF-8 and control characters, cap the length. */
function clean_text(mixed $v, int $max, bool $multiline = false): string
{
    if (is_array($v) || is_object($v)) {
        return '';
    }
    $s = (string)$v;
    if (!preg_match('//u', $s)) {
        return '';
    }
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = $multiline
        ? preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', '', $s)
        : preg_replace('/[\x00-\x1F\x7F]/u', ' ', $s);
    if ($multiline) {
        $s = preg_replace("/\n{4,}/", "\n\n\n", (string)$s);
    }
    return str_cut(trim((string)$s), $max);
}

function client_ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/** URL path of the folder the app is installed in, always ending with "/". */
function base_path(): string
{
    $dir = str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/')));
    return rtrim($dir, '/') . '/';
}

function base_url(): string
{
    $host = (string)($_SERVER['HTTP_HOST'] ?? 'localhost');
    if (!preg_match('/^[a-z0-9.\-]+(:\d+)?$/i', $host)) {
        $host = 'localhost';
    }
    return (is_https() ? 'https://' : 'http://') . $host . base_path();
}

function random_hex(int $bytes = 16): string
{
    return bin2hex(random_bytes($bytes));
}

function hmac(string $data): string
{
    return hash_hmac('sha256', $data, (string)cfg('app_secret'));
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function send_security_headers(string $kind): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (is_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
    if ($kind === 'app') {
        header('X-Frame-Options: SAMEORIGIN');
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            . "img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self'; connect-src 'self'; object-src 'none'; "
            . "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
        // Microphone for voice messages, location for "share location", camera for taking photos.
        header('Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)');
    }
}

/**
 * Normalise a phone number to E.164 ("+923001234567").
 * Numbers without "+" or "00" get the default country code and lose their trunk "0".
 */
function normalize_phone(string $raw, ?string $defaultCc = null): ?string
{
    $raw = trim($raw);
    if ($raw === '' || strlen($raw) > 32) {
        return null;
    }
    $international = str_starts_with($raw, '+') || str_starts_with($raw, '00');
    $digits = (string)preg_replace('/\D+/', '', $raw);
    if (str_starts_with($raw, '00')) {
        $digits = substr($digits, 2);
    }
    if (!$international) {
        $cc = preg_replace('/\D+/', '', (string)($defaultCc ?? cfg('default_country_code', '1')));
        $digits = $cc . ltrim($digits, '0');
    }
    if (strlen($digits) < 8 || strlen($digits) > 15 || $digits[0] === '0') {
        return null;
    }
    return '+' . $digits;
}

function request_json(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 4_000_000) {
        throw new ApiError('Request too large.', 413);
    }
    $data = $raw === '' ? [] : json_decode($raw, true);
    $cache = is_array($data) ? $data : [];
    return $cache;
}

function input(string $key, mixed $default = null): mixed
{
    $data = request_json();
    if (array_key_exists($key, $data)) {
        return $data[$key];
    }
    return $_POST[$key] ?? $_GET[$key] ?? $default;
}

function delete_tree(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $f) {
        $f->isDir() && !$f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    }
    @rmdir($dir);
}

function upload_error_message(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That file is larger than the server allows. Raise upload_max_filesize in cPanel → MultiPHP INI Editor.',
        UPLOAD_ERR_PARTIAL => 'The upload was interrupted. Please try again.',
        UPLOAD_ERR_NO_FILE => 'Choose a file to upload.',
        default => 'The upload failed (error ' . $code . ').',
    };
}
