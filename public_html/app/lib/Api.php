<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/** JSON API. Called as api.php?r=<route>. */
final class Api
{
    public static function routes(): array
    {
        return [
            'GET auth/me' => 'me',
            'POST auth/request-code' => 'requestCode',
            'POST auth/verify-code' => 'verifyCode',
            'POST auth/logout' => 'logout',
            'POST profile/update' => 'updateProfile',
            'POST profile/photo' => 'profilePhoto',
            'POST profile/delete' => 'deleteAccount',
            'GET contacts/lookup' => 'lookup',

            'GET chats' => 'chats',
            'GET chats/one' => 'chat',
            'GET chats/info' => 'chatInfo',
            'POST chats/open' => 'openChat',
            'POST chats/read' => 'read',
            'POST chats/typing' => 'typing',
            'POST chats/settings' => 'chatSettings',
            'POST chats/delete' => 'deleteChat',
            'POST chats/block' => 'block',
            'POST chats/unblock' => 'unblock',

            'POST groups/create' => 'createGroup',
            'POST groups/update' => 'updateGroup',
            'POST groups/photo' => 'groupPhoto',
            'POST groups/add' => 'addMembers',
            'POST groups/remove' => 'removeMember',
            'POST groups/admin' => 'setAdmin',
            'POST groups/leave' => 'leaveGroup',

            'GET messages' => 'messages',
            'GET messages/search' => 'searchMessages',
            'POST messages/send' => 'send',
            'POST messages/upload' => 'upload',
            'POST messages/location' => 'location',
            'POST messages/edit' => 'edit',
            'POST messages/delete' => 'deleteMessage',
            'POST messages/react' => 'react',
            'POST messages/forward' => 'forward',
            'GET poll' => 'poll',

            'GET site' => 'site',
            'POST site/save' => 'saveSite',
            'POST site/preview' => 'previewSite',
            'POST site/image' => 'uploadImage',
            'POST site/upload' => 'uploadCustom',
            'POST site/paste' => 'pasteSite',
            'GET site/code' => 'siteCode',
            'POST site/remove-custom' => 'removeCustom',
            'GET site/check-slug' => 'checkSlug',
            'GET sites/resolve' => 'resolveSite',
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
            json_out(self::$handler($user));
        } catch (ApiError $e) {
            json_out(['error' => $e->getMessage()] + $e->extra, $e->status);
        } catch (Throwable $e) {
            log_line('error.log', get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            json_out(['error' => is_dev() ? $e->getMessage() : 'Something went wrong. Please try again.'], 500);
        }
    }

    private static function id(string $key): int
    {
        return (int)input($key, 0);
    }

    private static function ids(string $key): array
    {
        $v = input($key, []);
        return is_array($v) ? array_map('intval', $v) : [];
    }

    private static function str(string $key, string $default = ''): string
    {
        $v = input($key, $default);
        return is_string($v) ? $v : $default;
    }

    // ------------------------------------------------------------------ account

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
                    'photo_mb' => (int)cfg('limits.photo_mb'),
                    'file_mb' => (int)cfg('limits.file_mb'),
                    'edit_seconds' => Chat::EDIT_WINDOW,
                    'delete_seconds' => Chat::DELETE_WINDOW,
                ],
            ],
        ];
    }

    private static function requestCode(?array $user): array
    {
        return Auth::requestCode(self::str('phone'));
    }

    private static function verifyCode(?array $user): array
    {
        $u = Auth::verifyCode(self::str('phone'), self::str('code'));
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
        return ['user' => Chat::presentUser(Db::one('SELECT * FROM users WHERE id = ?', [$user['id']]))];
    }

    private static function profilePhoto(array $user): array
    {
        $key = self::str('remove') === '1' ? '' : Media::storeAvatar($_FILES['file'] ?? []);
        Db::run('UPDATE users SET avatar = ? WHERE id = ?', [$key, $user['id']]);
        Media::deleteAvatar((string)$user['avatar']);
        return ['user' => Chat::presentUser(Db::one('SELECT * FROM users WHERE id = ?', [$user['id']]))];
    }

    /** Removes the profile, photo, site and files and leaves all groups. Messages already sent stay in other people's chats. */
    private static function deleteAccount(array $user): array
    {
        if (input('confirm') !== 'DELETE') {
            throw new ApiError('Type DELETE to confirm.', 422);
        }
        $id = (int)$user['id'];
        foreach (Db::all("SELECT cm.conversation_id FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id
                          WHERE cm.user_id = ? AND cm.left_id = 0 AND c.type = 'group'", [$id]) as $g) {
            Chat::leave($id, (int)$g['conversation_id']);
        }
        Sites::deleteAll($id);
        Media::deleteAvatar((string)$user['avatar']);
        Db::run('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [$id, $id]);
        Db::run('DELETE FROM otp_codes WHERE phone = ?', [$user['phone']]);
        Db::run("UPDATE users SET phone = ?, name = 'Deleted account', business_name = '', about = '', avatar = '', last_seen_at = 0 WHERE id = ?",
            ['deleted:' . $id . ':' . random_hex(4), $id]);
        Auth::logout();
        return ['ok' => true];
    }

    private static function lookup(array $user): array
    {
        $phone = normalize_phone(self::str('phone'));
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

    // ------------------------------------------------------------------ chats

    private static function chats(array $user): array
    {
        return ['chats' => Chat::list((int)$user['id']), 'now' => time(), 'useq' => Chat::currentUseq()];
    }

    private static function chat(array $user): array
    {
        return ['chat' => Chat::one((int)$user['id'], self::id('id'))];
    }

    private static function chatInfo(array $user): array
    {
        return Chat::info((int)$user['id'], self::id('id'));
    }

    private static function openChat(array $user): array
    {
        $peerId = self::id('user_id');
        if (!$peerId || !Db::one("SELECT id FROM users WHERE id = ? AND phone NOT LIKE 'deleted:%'", [$peerId])) {
            throw new ApiError('That person is not on ' . cfg('app_name') . ' yet.', 404);
        }
        $c = Chat::openDirect((int)$user['id'], $peerId);
        return ['chat' => Chat::one((int)$user['id'], (int)$c['id'])];
    }

    private static function read(array $user): array
    {
        Chat::markRead((int)$user['id'], self::id('chat'), self::id('upto'));
        return ['ok' => true];
    }

    private static function typing(array $user): array
    {
        Chat::typing((int)$user['id'], self::id('chat'));
        return ['ok' => true];
    }

    private static function chatSettings(array $user): array
    {
        $in = [];
        foreach (['pinned', 'archived', 'mute'] as $k) {
            $v = input($k);
            if ($v !== null) {
                $in[$k] = $v;
            }
        }
        return ['chat' => Chat::settings((int)$user['id'], self::id('chat'), $in)];
    }

    private static function deleteChat(array $user): array
    {
        Chat::deleteChat((int)$user['id'], self::id('chat'));
        return ['ok' => true];
    }

    private static function block(array $user): array
    {
        Chat::setBlocked((int)$user['id'], self::id('chat'), true);
        return ['chat' => Chat::one((int)$user['id'], self::id('chat'))];
    }

    private static function unblock(array $user): array
    {
        Chat::setBlocked((int)$user['id'], self::id('chat'), false);
        return ['chat' => Chat::one((int)$user['id'], self::id('chat'))];
    }

    // ------------------------------------------------------------------ groups

    private static function createGroup(array $user): array
    {
        $c = Chat::createGroup((int)$user['id'], self::str('title'), self::ids('user_ids'));
        return ['chat' => Chat::one((int)$user['id'], (int)$c['id'])];
    }

    private static function updateGroup(array $user): array
    {
        $title = input('title');
        $desc = input('description');
        Chat::updateGroup((int)$user['id'], self::id('chat'), is_string($title) ? $title : null, is_string($desc) ? $desc : null);
        return Chat::info((int)$user['id'], self::id('chat'));
    }

    private static function groupPhoto(array $user): array
    {
        Chat::setGroupPhoto((int)$user['id'], self::id('chat'), self::str('remove') === '1' ? null : ($_FILES['file'] ?? []));
        return Chat::info((int)$user['id'], self::id('chat'));
    }

    private static function addMembers(array $user): array
    {
        Chat::addMembers((int)$user['id'], self::id('chat'), self::ids('user_ids'));
        return Chat::info((int)$user['id'], self::id('chat'));
    }

    private static function removeMember(array $user): array
    {
        Chat::removeMember((int)$user['id'], self::id('chat'), self::id('user_id'));
        return Chat::info((int)$user['id'], self::id('chat'));
    }

    private static function setAdmin(array $user): array
    {
        Chat::setAdmin((int)$user['id'], self::id('chat'), self::id('user_id'), (bool)input('admin', true));
        return Chat::info((int)$user['id'], self::id('chat'));
    }

    private static function leaveGroup(array $user): array
    {
        Chat::leave((int)$user['id'], self::id('chat'));
        return ['chat' => Chat::one((int)$user['id'], self::id('chat'))];
    }

    // ------------------------------------------------------------------ messages

    private static function messages(array $user): array
    {
        return Chat::messages((int)$user['id'], self::id('chat'), self::id('before'), (int)input('limit', 50));
    }

    private static function searchMessages(array $user): array
    {
        return ['messages' => Chat::search((int)$user['id'], self::id('chat'), self::str('q'))];
    }

    private static function send(array $user): array
    {
        return ['message' => Chat::send((int)$user['id'], self::id('chat'), self::str('body'), self::id('reply_to'))];
    }

    private static function upload(array $user): array
    {
        $want = self::str('kind', 'file');
        $want = in_array($want, ['image', 'video', 'voice', 'file'], true) ? $want : 'file';
        return ['message' => Chat::sendMedia((int)$user['id'], self::id('chat'), $_FILES['file'] ?? [], $want,
            self::str('caption'), (float)input('duration', 0), self::id('reply_to'))];
    }

    private static function location(array $user): array
    {
        return ['message' => Chat::sendLocation((int)$user['id'], self::id('chat'), (float)input('lat', 0), (float)input('lng', 0), self::id('reply_to'))];
    }

    private static function edit(array $user): array
    {
        return ['message' => Chat::edit((int)$user['id'], self::id('id'), self::str('body'))];
    }

    private static function deleteMessage(array $user): array
    {
        Chat::delete((int)$user['id'], self::id('id'), self::str('for') === 'everyone');
        return ['ok' => true];
    }

    private static function react(array $user): array
    {
        return ['message' => Chat::react((int)$user['id'], self::id('id'), self::str('emoji'))];
    }

    private static function forward(array $user): array
    {
        return ['count' => Chat::forward((int)$user['id'], self::id('id'), self::ids('chats'))];
    }

    private static function poll(array $user): array
    {
        return Chat::poll((int)$user['id'], self::id('since'), self::id('rsince'), self::id('useq'));
    }

    // ------------------------------------------------------------------ mini-sites

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
        $template = self::str('template', 'shop');
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

    private static function pasteSite(array $user): array
    {
        return ['site' => Sites::present(Sites::pasteCustom((int)$user['id'], self::str('code'), input('publish', true) !== false))];
    }

    private static function siteCode(array $user): array
    {
        return Sites::customCode((int)$user['id']);
    }

    private static function removeCustom(array $user): array
    {
        return ['site' => Sites::present(Sites::removeCustom((int)$user['id']))];
    }

    private static function checkSlug(array $user): array
    {
        $slug = strtolower(trim(self::str('slug')));
        $site = Sites::forUser((int)$user['id']);
        $err = $slug === $site['slug'] ? null : Sites::checkSlug($slug, (int)$user['id']);
        return ['ok' => $err === null, 'error' => $err];
    }

    private static function resolveSite(array $user): array
    {
        $site = Sites::bySlug(self::str('slug'));
        if (!$site || !Sites::isLive($site)) {
            throw new ApiError('That site was not found.', 404);
        }
        $owner = Db::one('SELECT * FROM users WHERE id = ?', [$site['user_id']]);
        return ['user' => Chat::presentUser($owner, $site)];
    }
}
