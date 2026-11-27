<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/** JSON API. Called as api.php?r=<route>. */
final class Api
{
    public static function routes(): array
    {
        return [
            'GET auth/me' => [self::class, 'me'],
            'POST auth/request-code' => [self::class, 'requestCode'],
            'POST auth/verify-code' => [self::class, 'verifyCode'],
            'POST auth/logout' => [self::class, 'logout'],
            'POST profile/update' => [self::class, 'updateProfile'],
            'POST profile/delete' => [self::class, 'deleteAccount'],
            'GET contacts/lookup' => [self::class, 'lookup'],
            'GET chats' => [self::class, 'chats'],
            'GET chats/one' => [self::class, 'chat'],
            'POST chats/open' => [self::class, 'openChat'],
            'POST chats/read' => [self::class, 'read'],
            'POST chats/block' => [self::class, 'block'],
            'POST chats/unblock' => [self::class, 'unblock'],
            'GET messages' => [self::class, 'messages'],
            'POST messages/send' => [self::class, 'send'],
            'GET poll' => [self::class, 'poll'],
            'GET site' => [self::class, 'site'],
            'POST site/save' => [self::class, 'saveSite'],
            'POST site/preview' => [self::class, 'previewSite'],
            'POST site/image' => [self::class, 'uploadImage'],
            'POST site/upload' => [self::class, 'uploadCustom'],
            'POST site/remove-custom' => [self::class, 'removeCustom'],
            'GET site/check-slug' => [self::class, 'checkSlug'],
            'GET sites/resolve' => [self::class, 'resolveSite'],
        ];
    }

    private const PUBLIC = ['auth/me', 'auth/request-code', 'auth/verify-code', 'auth/logout'];

    public static function handle(string $route): never
    {
        try {
            if (!cfg('installed')) {
                throw new ApiError('ChatSite is not installed yet. Open install.php to finish setup.', 503);
            }
            $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
            $handler = self::routes()[$method . ' ' . $route] ?? null;
            if (!$handler) {
                throw new ApiError('Not found.', 404);
            }
            Auth::startSession();
            if ($method !== 'GET') {
                Auth::checkCsrf();
            }
            $user = in_array($route, self::PUBLIC, true) ? Auth::user() : Auth::requireUser();
            if ($method === 'GET') {
                session_write_close();   // don't hold the session lock while polling
            }
            json_out($handler($user));
        } catch (ApiError $e) {
            json_out(['error' => $e->getMessage()] + $e->extra, $e->status);
        } catch (Throwable $e) {
            log_line('error.log', get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            json_out(['error' => is_dev() ? $e->getMessage() : 'Something went wrong. Please try again.'], 500);
        }
    }

    private static function me(?array $user): array
    {
        $templates = [];
        foreach (Sites::TEMPLATES as $id => $t) {
            $templates[] = ['id' => $id] + $t;
        }
        return [
            'user' => $user ? Chat::presentUser($user) : null,
            'csrf' => Auth::csrfToken(),
            'config' => [
                'app_name' => cfg('app_name'),
                'dev' => is_dev(),
                'default_country_code' => (string)cfg('default_country_code'),
                'templates' => $templates,
                'limits' => [
                    'message_length' => (int)cfg('limits.message_length'),
                    'custom_upload_mb' => (int)cfg('limits.custom_upload_mb'),
                    'image_mb' => (int)cfg('limits.image_mb'),
                ],
            ],
        ];
    }

    private static function requestCode(?array $user): array
    {
        return Auth::requestCode((string)input('phone', ''));
    }

    private static function verifyCode(?array $user): array
    {
        $u = Auth::verifyCode((string)input('phone', ''), (string)input('code', ''));
        return ['user' => Chat::presentUser($u), 'csrf' => Auth::csrfToken()];
    }

    private static function logout(?array $user): array
    {
        Auth::logout();
        return ['ok' => true];
    }

    private static function updateProfile(array $user): array
    {
        $name = clean_text(input('name', ''), 60);
        if ($name === '') {
            throw new ApiError('Please enter your name.', 422, ['field' => 'name']);
        }
        Db::run('UPDATE users SET name = ?, business_name = ?, about = ? WHERE id = ?', [
            $name, clean_text(input('business_name', ''), 60), clean_text(input('about', ''), 160), $user['id'],
        ]);
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$user['id']]);
        return ['user' => Chat::presentUser($u)];
    }

    /** Removes the account's profile, site and files. Messages already delivered stay in the other person's chat. */
    private static function deleteAccount(array $user): array
    {
        if (input('confirm') !== 'DELETE') {
            throw new ApiError('Type DELETE to confirm.', 422);
        }
        $id = (int)$user['id'];
        Sites::deleteAll($id);
        Db::run('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [$id, $id]);
        Db::run('DELETE FROM otp_codes WHERE phone = ?', [$user['phone']]);
        Db::run("UPDATE users SET phone = ?, name = 'Deleted account', business_name = '', about = '', last_seen_at = 0 WHERE id = ?",
            ['deleted:' . $id . ':' . random_hex(4), $id]);
        Auth::logout();
        return ['ok' => true];
    }

    private static function lookup(array $user): array
    {
        $phone = normalize_phone((string)input('phone', ''));
        if ($phone === null) {
            throw new ApiError('Enter a valid mobile number including the country code.', 422);
        }
        $u = Db::one('SELECT * FROM users WHERE phone = ?', [$phone]);
        if (!$u) {
            return ['phone' => $phone, 'user' => null];
        }
        $site = Db::one('SELECT * FROM sites WHERE user_id = ?', [$u['id']]);
        return ['phone' => $phone, 'user' => Chat::presentUser($u, $site)];
    }

    private static function chats(array $user): array
    {
        return ['chats' => Chat::list((int)$user['id']), 'now' => time()];
    }

    private static function chat(array $user): array
    {
        return ['chat' => Chat::one((int)$user['id'], (int)input('id', 0))];
    }

    private static function openChat(array $user): array
    {
        $peerId = (int)input('user_id', 0);
        if (!$peerId || !Db::one('SELECT id FROM users WHERE id = ? AND phone NOT LIKE ?', [$peerId, 'deleted:%'])) {
            throw new ApiError('That person is not on ' . cfg('app_name') . ' yet.', 404);
        }
        $c = Chat::open((int)$user['id'], $peerId);
        return ['chat' => Chat::one((int)$user['id'], (int)$c['id'])];
    }

    private static function read(array $user): array
    {
        Chat::markRead((int)$user['id'], (int)input('chat', 0), (int)input('upto', 0));
        return ['ok' => true];
    }

    private static function block(array $user): array
    {
        Chat::setBlocked((int)$user['id'], (int)input('chat', 0), true);
        return ['chat' => Chat::one((int)$user['id'], (int)input('chat', 0))];
    }

    private static function unblock(array $user): array
    {
        Chat::setBlocked((int)$user['id'], (int)input('chat', 0), false);
        return ['chat' => Chat::one((int)$user['id'], (int)input('chat', 0))];
    }

    private static function messages(array $user): array
    {
        return Chat::messages((int)$user['id'], (int)input('chat', 0), (int)input('before', 0), (int)input('limit', 50));
    }

    private static function send(array $user): array
    {
        return ['message' => Chat::send((int)$user['id'], (int)input('chat', 0), (string)input('body', ''))];
    }

    private static function poll(array $user): array
    {
        return Chat::poll((int)$user['id'], (int)input('since', 0), (int)input('rsince', 0));
    }

    private static function site(array $user): array
    {
        return ['site' => Sites::present(Sites::forUser((int)$user['id']))];
    }

    private static function saveSite(array $user): array
    {
        return ['site' => Sites::present(Sites::save((int)$user['id'], request_json()))];
    }

    private static function previewSite(array $user): array
    {
        $site = Sites::forUser((int)$user['id']);
        $template = (string)input('template', 'shop');
        $data = Sites::cleanData(input('data', []) ?: ['title' => 'Preview']);
        return ['html' => Sites::render($template, $data, $user, (string)$site['slug'], Sites::url((string)$site['slug']))];
    }

    private static function uploadImage(array $user): array
    {
        return Sites::uploadImage((int)$user['id'], $_FILES['file'] ?? []);
    }

    private static function uploadCustom(array $user): array
    {
        return ['site' => Sites::present(Sites::uploadCustom((int)$user['id'], $_FILES['file'] ?? []))];
    }

    private static function removeCustom(array $user): array
    {
        return ['site' => Sites::present(Sites::removeCustom((int)$user['id']))];
    }

    private static function checkSlug(array $user): array
    {
        $slug = strtolower(trim((string)input('slug', '')));
        $site = Sites::forUser((int)$user['id']);
        $err = $slug === $site['slug'] ? null : Sites::checkSlug($slug, (int)$user['id']);
        return ['ok' => $err === null, 'error' => $err];
    }

    private static function resolveSite(array $user): array
    {
        $site = Sites::bySlug((string)input('slug', ''));
        if (!$site || !Sites::isLive($site)) {
            throw new ApiError('That site was not found.', 404);
        }
        $owner = Db::one('SELECT * FROM users WHERE id = ?', [$site['user_id']]);
        return ['user' => Chat::presentUser($owner, $site)];
    }
}
