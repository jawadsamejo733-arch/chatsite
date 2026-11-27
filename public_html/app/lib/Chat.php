<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/**
 * Direct and group chats.
 * Each member has a row in conversation_members holding their read/delivered "high-water marks"
 * (so ticks are cheap), what part of the history they can see, and their pin/mute/archive settings.
 */
final class Chat
{
    public const ONLINE_WINDOW = 45;
    public const TYPING_WINDOW = 6;
    public const EDIT_WINDOW = 900;          // 15 minutes
    public const DELETE_WINDOW = 172800;     // "delete for everyone" within 2 days
    public const MAX_GROUP = 256;
    public const MAX_PINNED = 3;
    public const MUTE_ALWAYS = 2147483647;

    /** Messages a member may see: after they joined/cleared, before they left, not deleted "for me". */
    private const VISIBLE = 'm.id > cm.cleared_id AND (cm.left_id = 0 OR m.id <= cm.left_id)
        AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = cm.user_id)';

    private const MEMBER_COLS = 'cm.role AS my_role, cm.read_id AS my_read_id, cm.delivered_id AS my_delivered_id,
        cm.cleared_id AS my_cleared_id, cm.left_id AS my_left_id, cm.archived AS my_archived,
        cm.pinned_at AS my_pinned_at, cm.muted_until AS my_muted_until';

    // ------------------------------------------------------------------ people

    public static function presentUser(array $u, ?array $site = null): array
    {
        $out = [
            'id' => (int)$u['id'],
            'phone' => str_starts_with((string)$u['phone'], 'deleted:') ? '' : (string)$u['phone'],
            'name' => (string)$u['name'],
            'business_name' => (string)$u['business_name'],
            'about' => (string)$u['about'],
            'display_name' => self::displayName($u),
            'avatar' => Media::avatarUrl((string)($u['avatar'] ?? '')),
            'online' => (int)$u['last_seen_at'] >= time() - self::ONLINE_WINDOW,
            'last_seen_at' => (int)$u['last_seen_at'],
            'site' => null,
        ];
        if ($site && Sites::isLive($site)) {
            $out['site'] = ['slug' => (string)$site['slug'], 'url' => Sites::url((string)$site['slug'])];
        }
        return $out;
    }

    public static function displayName(?array $u): string
    {
        if (!$u) {
            return 'Someone';
        }
        foreach (['business_name', 'name', 'phone'] as $k) {
            if (trim((string)($u[$k] ?? '')) !== '') {
                return (string)$u[$k];
            }
        }
        return 'Unknown';
    }

    /** A person's own name ("Sara Khan") rather than their business name, for "Sara is typing…" and group previews. */
    public static function personName(?array $u): string
    {
        return $u && trim((string)$u['name']) !== '' ? (string)$u['name'] : self::displayName($u);
    }

    /** @return array<int,array> users by id */
    public static function users(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) {
            return [];
        }
        $out = [];
        foreach (Db::all('SELECT * FROM users WHERE id IN (' . self::in($ids) . ')', $ids) as $r) {
            $out[(int)$r['id']] = $r;
        }
        return $out;
    }

    private static function in(array $ids): string
    {
        return implode(',', array_fill(0, max(1, count($ids)), '?'));
    }

    private static function validUserIds(array $ids, int $me): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn($id) => $id > 0 && $id !== $me)));
        if (!$ids) {
            return [];
        }
        $rows = Db::all('SELECT id FROM users WHERE id IN (' . self::in($ids) . ") AND phone NOT LIKE 'deleted:%'", $ids);
        return array_map(fn($r) => (int)$r['id'], $rows);
    }

    public static function isBlocked(int $blocker, int $blocked): bool
    {
        return (bool)Db::value('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [$blocker, $blocked]);
    }

    // ------------------------------------------------------------------ membership

    public static function conversation(int $me, int $cid): array
    {
        $c = Db::one('SELECT c.*, ' . self::MEMBER_COLS . ' FROM conversations c
            JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ? WHERE c.id = ?', [$me, $cid]);
        if (!$c) {
            throw new ApiError('Chat not found.', 404);
        }
        return $c;
    }

    private static function requireActive(array $c): void
    {
        if ((int)$c['my_left_id'] !== 0) {
            throw new ApiError("You're no longer a participant in this group.", 403);
        }
    }

    private static function requireAdmin(array $c): void
    {
        self::requireActive($c);
        if ($c['type'] !== 'group' || $c['my_role'] !== 'admin') {
            throw new ApiError('Only group admins can do that.', 403);
        }
    }

    public static function directPeer(int $cid, int $me): ?int
    {
        $v = Db::value('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1', [$cid, $me]);
        return $v === null ? null : (int)$v;
    }

    private static function activeMemberIds(int $cid): array
    {
        return array_map(fn($r) => (int)$r['user_id'], Db::all('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND left_id = 0', [$cid]));
    }

    private static function putMember(int $cid, int $uid, string $role, int $fromId, bool $hidden): void
    {
        $exists = Db::value('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [$cid, $uid]);
        if ($exists) {
            Db::run('UPDATE conversation_members SET role = ?, left_id = 0, cleared_id = ?, read_id = ?, delivered_id = ?, hidden = ?, joined_at = ?
                     WHERE conversation_id = ? AND user_id = ?', [$role, $fromId, $fromId, $fromId, $hidden ? 1 : 0, time(), $cid, $uid]);
            return;
        }
        Db::run('INSERT INTO conversation_members (conversation_id, user_id, role, read_id, delivered_id, cleared_id, left_id, hidden, joined_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)', [$cid, $uid, $role, $fromId, $fromId, $fromId, $hidden ? 1 : 0, time()]);
    }

    public static function openDirect(int $me, int $peer): array
    {
        if ($me === $peer) {
            throw new ApiError("That's your own number.");
        }
        [$a, $b] = $me < $peer ? [$me, $peer] : [$peer, $me];
        $key = $a . ':' . $b;
        $cid = Db::value('SELECT id FROM conversations WHERE direct_key = ?', [$key]);
        if ($cid === null) {
            try {
                Db::tx(function () use ($key, $me, $peer) {
                    $now = time();
                    $id = Db::insert("INSERT INTO conversations (type, direct_key, created_by, created_at, updated_at) VALUES ('direct', ?, ?, ?, ?)", [$key, $me, $now, $now]);
                    self::putMember($id, $me, 'member', 0, false);
                    self::putMember($id, $peer, 'member', 0, true);   // hidden for them until the first message
                });
            } catch (Throwable $e) {
                if (!Db::isUniqueViolation($e)) {
                    throw $e;
                }
            }
            $cid = Db::value('SELECT id FROM conversations WHERE direct_key = ?', [$key]);
        } else {
            Db::run('UPDATE conversation_members SET hidden = 0 WHERE conversation_id = ? AND user_id = ?', [$cid, $me]);
        }
        return self::conversation($me, (int)$cid);
    }

    // ------------------------------------------------------------------ groups

    public static function createGroup(int $me, string $title, array $userIds): array
    {
        $title = clean_text($title, 80);
        if ($title === '') {
            throw new ApiError('Give your group a name.', 422);
        }
        $ids = self::validUserIds($userIds, $me);
        if (!$ids) {
            throw new ApiError('Add at least one person to the group.', 422);
        }
        if (count($ids) + 1 > self::MAX_GROUP) {
            throw new ApiError('Groups can have up to ' . self::MAX_GROUP . ' members.', 422);
        }
        $cid = Db::tx(function () use ($me, $title, $ids) {
            $now = time();
            $cid = Db::insert("INSERT INTO conversations (type, title, created_by, created_at, updated_at) VALUES ('group', ?, ?, ?, ?)", [$title, $me, $now, $now]);
            self::putMember($cid, $me, 'admin', 0, false);
            foreach ($ids as $id) {
                self::putMember($cid, $id, 'member', 0, false);
            }
            self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('create', ['t' => $title])]);
            return $cid;
        });
        return self::conversation($me, $cid);
    }

    private static function event(string $e, array $data = []): string
    {
        return (string)json_encode(['e' => $e] + $data, JSON_UNESCAPED_UNICODE);
    }

    public static function addMembers(int $me, int $cid, array $userIds): void
    {
        $c = self::conversation($me, $cid);
        self::requireAdmin($c);
        $active = self::activeMemberIds($cid);
        $new = array_values(array_diff(self::validUserIds($userIds, $me), $active));
        if (!$new) {
            throw new ApiError('Those people are already in the group.', 422);
        }
        if (count($active) + count($new) > self::MAX_GROUP) {
            throw new ApiError('Groups can have up to ' . self::MAX_GROUP . ' members.', 422);
        }
        Db::tx(function () use ($cid, $me, $new) {
            $last = (int)Db::value('SELECT last_message_id FROM conversations WHERE id = ?', [$cid]);
            foreach ($new as $id) {
                self::putMember($cid, $id, 'member', $last, false);   // new members don't see older history
            }
            self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('add', ['u' => $new])]);
        });
    }

    public static function removeMember(int $me, int $cid, int $uid): void
    {
        $c = self::conversation($me, $cid);
        self::requireAdmin($c);
        if ($uid === $me) {
            throw new ApiError('Use "Exit group" to leave.', 422);
        }
        if (!in_array($uid, self::activeMemberIds($cid), true)) {
            throw new ApiError("That person isn't in this group.", 404);
        }
        Db::tx(function () use ($cid, $me, $uid) {
            $mid = self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('remove', ['u' => [$uid]])]);
            Db::run("UPDATE conversation_members SET left_id = ?, role = 'member', typing_at = 0 WHERE conversation_id = ? AND user_id = ?", [$mid, $cid, $uid]);
        });
    }

    public static function leave(int $me, int $cid): void
    {
        $c = self::conversation($me, $cid);
        self::requireActive($c);
        if ($c['type'] !== 'group') {
            throw new ApiError('You can only exit groups.', 422);
        }
        Db::tx(function () use ($cid, $me, $c) {
            $mid = self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('leave')]);
            Db::run("UPDATE conversation_members SET left_id = ?, role = 'member', typing_at = 0, pinned_at = 0 WHERE conversation_id = ? AND user_id = ?", [$mid, $cid, $me]);
            // If the last admin leaves, the longest-standing member becomes admin.
            if ($c['my_role'] === 'admin' && !Db::value("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND left_id = 0 AND role = 'admin'", [$cid])) {
                $next = Db::value('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND left_id = 0 ORDER BY joined_at ASC LIMIT 1', [$cid]);
                if ($next !== null) {
                    Db::run("UPDATE conversation_members SET role = 'admin' WHERE conversation_id = ? AND user_id = ?", [$cid, $next]);
                    self::insertMessage($cid, (int)$next, ['kind' => 'system', 'body' => self::event('admin', ['u' => [(int)$next]])]);
                }
            }
        });
    }

    public static function setAdmin(int $me, int $cid, int $uid, bool $admin): void
    {
        $c = self::conversation($me, $cid);
        self::requireAdmin($c);
        if (!in_array($uid, self::activeMemberIds($cid), true) || $uid === $me) {
            throw new ApiError("That person isn't in this group.", 404);
        }
        Db::run('UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?', [$admin ? 'admin' : 'member', $cid, $uid]);
        if ($admin) {
            self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('admin', ['u' => [$uid]])]);
        }
    }

    public static function updateGroup(int $me, int $cid, ?string $title, ?string $description): void
    {
        $c = self::conversation($me, $cid);
        self::requireAdmin($c);
        if ($title !== null) {
            $title = clean_text($title, 80);
            if ($title === '') {
                throw new ApiError('Give your group a name.', 422);
            }
            if ($title !== $c['title']) {
                Db::run('UPDATE conversations SET title = ? WHERE id = ?', [$title, $cid]);
                self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('title', ['t' => $title])]);
            }
        }
        if ($description !== null) {
            $description = clean_text($description, 500, true);
            if ($description !== $c['description']) {
                Db::run('UPDATE conversations SET description = ? WHERE id = ?', [$description, $cid]);
                self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event('desc')]);
            }
        }
    }

    public static function setGroupPhoto(int $me, int $cid, ?array $file): void
    {
        $c = self::conversation($me, $cid);
        self::requireAdmin($c);
        $key = $file ? Media::storeAvatar($file) : '';
        Db::run('UPDATE conversations SET avatar = ? WHERE id = ?', [$key, $cid]);
        Media::deleteAvatar((string)$c['avatar']);
        self::insertMessage($cid, $me, ['kind' => 'system', 'body' => self::event($key === '' ? 'nophoto' : 'photo')]);
    }

    public static function info(int $me, int $cid): array
    {
        $chat = self::one($me, $cid);
        $rows = Db::all("SELECT user_id, role FROM conversation_members WHERE conversation_id = ? AND left_id = 0
                         ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, joined_at ASC", [$cid]);
        $users = self::users(array_column($rows, 'user_id'));
        $members = [];
        foreach ($rows as $r) {
            if (isset($users[(int)$r['user_id']])) {
                $members[] = self::presentUser($users[(int)$r['user_id']]) + ['role' => (string)$r['role']];
            }
        }
        return ['chat' => $chat, 'members' => $members];
    }

    // ------------------------------------------------------------------ chat list

    public static function list(int $me): array
    {
        $rows = Db::all('SELECT c.*, ' . self::MEMBER_COLS . ' FROM conversation_members cm
            JOIN conversations c ON c.id = cm.conversation_id
            WHERE cm.user_id = ? AND cm.hidden = 0 ORDER BY c.updated_at DESC, c.id DESC LIMIT 500', [$me]);
        return self::presentMany($rows, $me);
    }

    public static function one(int $me, int $cid): array
    {
        return self::presentMany([self::conversation($me, $cid)], $me)[0];
    }

    private static function presentMany(array $rows, int $me): array
    {
        if (!$rows) {
            return [];
        }
        $now = time();
        $cids = array_map(fn($r) => (int)$r['id'], $rows);

        $lastIds = [];
        foreach ($rows as $r) {
            $last = (int)$r['last_message_id'];
            if ((int)$r['my_left_id'] > 0) {
                $last = min($last, (int)$r['my_left_id']);
            }
            if ($last > (int)$r['my_cleared_id']) {
                $lastIds[(int)$r['id']] = $last;
            }
        }
        $msgs = [];
        if ($lastIds) {
            $ids = array_values($lastIds);
            foreach (Db::all('SELECT * FROM messages WHERE id IN (' . self::in($ids) . ')', $ids) as $m) {
                $msgs[(int)$m['id']] = $m;
            }
        }

        $others = [];
        foreach (Db::all('SELECT conversation_id, user_id, read_id, delivered_id, left_id, typing_at FROM conversation_members
                          WHERE conversation_id IN (' . self::in($cids) . ') AND user_id <> ?', [...$cids, $me]) as $o) {
            $others[(int)$o['conversation_id']][] = $o;
        }

        $userIds = [];
        foreach ($rows as $r) {
            if ($r['type'] === 'direct') {
                foreach ($others[(int)$r['id']] ?? [] as $o) {
                    $userIds[] = (int)$o['user_id'];
                }
            }
            foreach ($others[(int)$r['id']] ?? [] as $o) {
                if ((int)$o['typing_at'] >= $now - self::TYPING_WINDOW) {
                    $userIds[] = (int)$o['user_id'];
                }
            }
        }
        foreach ($msgs as $m) {
            $userIds = array_merge($userIds, self::mentionedUsers($m));
        }
        $users = self::users($userIds);

        $sites = [];
        $directPeers = [];
        foreach ($rows as $r) {
            if ($r['type'] === 'direct' && isset($others[(int)$r['id']][0])) {
                $directPeers[] = (int)$others[(int)$r['id']][0]['user_id'];
            }
        }
        if ($directPeers) {
            foreach (Db::all('SELECT * FROM sites WHERE user_id IN (' . self::in($directPeers) . ')', $directPeers) as $s) {
                $sites[(int)$s['user_id']] = $s;
            }
        }
        $blocked = [];
        foreach (Db::all('SELECT blocked_id FROM blocks WHERE blocker_id = ?', [$me]) as $b) {
            $blocked[(int)$b['blocked_id']] = true;
        }
        $unread = self::unreadCounts($me, $cids);

        $out = [];
        foreach ($rows as $r) {
            $cid = (int)$r['id'];
            $isGroup = $r['type'] === 'group';
            $amActive = (int)$r['my_left_id'] === 0;
            $list = $others[$cid] ?? [];
            $active = array_values(array_filter($list, fn($o) => (int)$o['left_id'] === 0));
            $peer = null;
            if (!$isGroup && isset($list[0]) && isset($users[(int)$list[0]['user_id']])) {
                $pid = (int)$list[0]['user_id'];
                $peer = self::presentUser($users[$pid], $sites[$pid] ?? null);
            }
            $typing = [];
            if ($amActive) {
                foreach ($active as $o) {
                    if ((int)$o['typing_at'] >= $now - self::TYPING_WINDOW) {
                        $typing[] = ['id' => (int)$o['user_id'], 'name' => self::personName($users[(int)$o['user_id']] ?? null)];
                    }
                }
            }
            $last = isset($lastIds[$cid]) ? ($msgs[$lastIds[$cid]] ?? null) : null;
            $out[] = [
                'id' => $cid,
                'type' => (string)$r['type'],
                'title' => $isGroup ? (string)$r['title'] : ($peer['display_name'] ?? 'Deleted account'),
                'avatar' => $isGroup ? Media::avatarUrl((string)$r['avatar']) : ($peer['avatar'] ?? ''),
                'description' => $isGroup ? (string)$r['description'] : '',
                'peer' => $peer,
                'members_count' => $isGroup ? count($active) + ($amActive ? 1 : 0) : 2,
                'my_role' => (string)$r['my_role'],
                'active' => $amActive,
                'my_read_id' => (int)$r['my_read_id'],
                'unread' => $unread[$cid] ?? 0,
                'updated_at' => (int)$r['updated_at'],
                'peer_read_id' => $active ? min(array_map(fn($o) => (int)$o['read_id'], $active)) : 0,
                'peer_delivered_id' => $active ? min(array_map(fn($o) => (int)$o['delivered_id'], $active)) : 0,
                'blocked' => $peer !== null && isset($blocked[$peer['id']]),
                'archived' => (bool)(int)$r['my_archived'],
                'pinned' => (int)$r['my_pinned_at'] > 0,
                'pinned_at' => (int)$r['my_pinned_at'],
                'muted' => (int)$r['my_muted_until'] > $now,
                'muted_until' => (int)$r['my_muted_until'],
                'typing' => $typing,
                'last' => $last ? self::lastPreview($last, $me, $users) : null,
            ];
        }
        return $out;
    }

    private static function unreadCounts(int $me, array $cids): array
    {
        if (!$cids) {
            return [];
        }
        $out = [];
        foreach (Db::all('SELECT m.conversation_id AS cid, COUNT(*) AS n FROM messages m
            JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
            WHERE m.conversation_id IN (' . self::in($cids) . ") AND m.id > cm.read_id AND m.sender_id <> ? AND m.kind <> 'system' AND " . self::VISIBLE . '
            GROUP BY m.conversation_id', [$me, ...$cids, $me]) as $r) {
            $out[(int)$r['cid']] = (int)$r['n'];
        }
        return $out;
    }

    // ------------------------------------------------------------------ message presentation

    private static function mentionedUsers(array $m): array
    {
        $ids = [(int)$m['sender_id']];
        if ($m['kind'] === 'system') {
            $e = json_decode((string)$m['body'], true);
            $ids = array_merge($ids, array_map('intval', (array)($e['u'] ?? [])));
        }
        return $ids;
    }

    private static function fmtDuration(float $s): string
    {
        $s = (int)round($s);
        return intdiv($s, 60) . ':' . str_pad((string)($s % 60), 2, '0', STR_PAD_LEFT);
    }

    /** One-line description of a message, used for chat-list previews, replies and notifications. */
    public static function previewText(array $m): string
    {
        if ((int)$m['deleted_at'] > 0) {
            return 'This message was deleted';
        }
        $media = json_decode((string)$m['media'], true) ?: [];
        $caption = trim((string)$m['body']);
        return match ((string)$m['kind']) {
            'image' => '📷 ' . ($caption !== '' ? $caption : 'Photo'),
            'video' => '🎥 ' . ($caption !== '' ? $caption : 'Video'),
            'voice' => '🎤 Voice message (' . self::fmtDuration((float)($media['dur'] ?? 0)) . ')',
            'file' => '📄 ' . ($media['name'] ?? 'Document'),
            'location' => '📍 Location',
            default => str_cut($caption, 150),
        };
    }

    private static function lastPreview(array $m, int $me, array $users): array
    {
        $mine = (int)$m['sender_id'] === $me;
        $text = match (true) {
            (int)$m['deleted_at'] > 0 => $mine ? 'You deleted this message' : 'This message was deleted',
            $m['kind'] === 'system' => self::systemText($m, $me, $users),
            default => self::previewText($m),
        };
        return [
            'id' => (int)$m['id'],
            'kind' => (string)$m['kind'],
            'text' => $text,
            'mine' => $mine,
            'sender_name' => $mine ? 'You' : self::personName($users[(int)$m['sender_id']] ?? null),
            'created_at' => (int)$m['created_at'],
            'deleted' => (int)$m['deleted_at'] > 0,
        ];
    }

    private static function systemText(array $m, int $me, array $users): string
    {
        $e = json_decode((string)$m['body'], true) ?: [];
        $actor = (int)$m['sender_id'] === $me ? 'You' : self::displayName($users[(int)$m['sender_id']] ?? null);
        $names = function (array $ids) use ($me, $users): string {
            $n = array_map(fn($id) => (int)$id === $me ? 'you' : self::displayName($users[(int)$id] ?? null), $ids);
            return count($n) > 1 ? implode(', ', array_slice($n, 0, -1)) . ' and ' . end($n) : (string)($n[0] ?? 'someone');
        };
        $targets = (array)($e['u'] ?? []);
        return match ((string)($e['e'] ?? '')) {
            'create' => "{$actor} created group “" . ($e['t'] ?? '') . '”',
            'add' => "{$actor} added " . $names($targets),
            'remove' => "{$actor} removed " . $names($targets),
            'leave' => "{$actor} left",
            'title' => "{$actor} changed the group name to “" . ($e['t'] ?? '') . '”',
            'desc' => "{$actor} changed the group description",
            'photo' => "{$actor} changed the group photo",
            'nophoto' => "{$actor} removed the group photo",
            'admin' => in_array($me, array_map('intval', $targets), true) ? "You're now an admin" : $names($targets) . ' is now an admin',
            default => '',
        };
    }

    public static function presentMessages(array $rows, int $me): array
    {
        if (!$rows) {
            return [];
        }
        $ids = array_map(fn($r) => (int)$r['id'], $rows);
        $replyIds = array_values(array_unique(array_filter(array_map(fn($r) => (int)$r['reply_to'], $rows))));
        $replies = [];
        if ($replyIds) {
            foreach (Db::all('SELECT * FROM messages WHERE id IN (' . self::in($replyIds) . ')', $replyIds) as $r) {
                $replies[(int)$r['id']] = $r;
            }
        }
        $userIds = [];
        foreach (array_merge($rows, array_values($replies)) as $r) {
            $userIds = array_merge($userIds, self::mentionedUsers($r));
        }
        $users = self::users($userIds);
        $reactions = [];
        foreach (Db::all('SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (' . self::in($ids) . ') ORDER BY created_at ASC', $ids) as $r) {
            $reactions[(int)$r['message_id']][(string)$r['emoji']][] = (int)$r['user_id'];
        }

        $out = [];
        foreach ($rows as $m) {
            $id = (int)$m['id'];
            $deleted = (int)$m['deleted_at'] > 0;
            $kind = (string)$m['kind'];
            $media = null;
            if (!$deleted && $kind === 'location') {
                $loc = json_decode((string)$m['media'], true) ?: [];
                $media = ['lat' => (float)($loc['lat'] ?? 0), 'lng' => (float)($loc['lng'] ?? 0)];
            } elseif (!$deleted) {
                $media = Media::present((string)$m['media_key'], (string)$m['media']);
            }
            $reply = null;
            if ((int)$m['reply_to'] > 0 && isset($replies[(int)$m['reply_to']])) {
                $r = $replies[(int)$m['reply_to']];
                $reply = [
                    'id' => (int)$r['id'],
                    'sender' => (int)$r['sender_id'],
                    'sender_name' => (int)$r['sender_id'] === $me ? 'You' : self::displayName($users[(int)$r['sender_id']] ?? null),
                    'kind' => (string)$r['kind'],
                    'text' => self::previewText($r),
                ];
            }
            $reacts = [];
            foreach ($reactions[$id] ?? [] as $emoji => $uids) {
                $reacts[] = ['e' => (string)$emoji, 'u' => $uids];
            }
            $out[] = [
                'id' => $id,
                'chat' => (int)$m['conversation_id'],
                'sender' => (int)$m['sender_id'],
                'sender_name' => self::displayName($users[(int)$m['sender_id']] ?? null),
                'sender_short' => self::personName($users[(int)$m['sender_id']] ?? null),
                'kind' => $kind,
                'body' => $deleted || $kind === 'system' ? '' : (string)$m['body'],
                'text' => $kind === 'system' ? self::systemText($m, $me, $users) : null,
                'media' => $media,
                'reply' => $reply,
                'forwarded' => (bool)(int)$m['forwarded'],
                'edited' => (int)$m['edited_at'] > 0,
                'deleted' => $deleted,
                'reactions' => $reacts,
                'created_at' => (int)$m['created_at'],
            ];
        }
        return $out;
    }

    public static function message(int $me, int $id): array
    {
        return self::presentMessages([Db::one('SELECT * FROM messages WHERE id = ?', [$id])], $me)[0];
    }

    // ------------------------------------------------------------------ sending

    private static function insertMessage(int $cid, int $sender, array $f): int
    {
        return Db::tx(function () use ($cid, $sender, $f) {
            $now = time();
            $id = Db::insert(
                'INSERT INTO messages (conversation_id, sender_id, kind, body, media_key, media, reply_to, forwarded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$cid, $sender, $f['kind'] ?? 'text', (string)($f['body'] ?? ''), (string)($f['media_key'] ?? ''), (string)($f['media'] ?? ''),
                    (int)($f['reply_to'] ?? 0), !empty($f['forwarded']) ? 1 : 0, $now]
            );
            Db::run('UPDATE conversations SET last_message_id = ?, updated_at = ? WHERE id = ?', [$id, $now, $cid]);
            Db::run('UPDATE conversation_members SET hidden = 0 WHERE conversation_id = ? AND left_id = 0 AND hidden = 1', [$cid]);
            Db::run('UPDATE conversation_members SET read_id = ?, delivered_id = ?, typing_at = 0 WHERE conversation_id = ? AND user_id = ? AND left_id = 0', [$id, $id, $cid, $sender]);
            return $id;
        });
    }

    private static function checkCanSend(int $me, array $c): void
    {
        self::requireActive($c);
        if ($c['type'] === 'direct') {
            $peer = self::directPeer((int)$c['id'], $me);
            if ($peer !== null && self::isBlocked($me, $peer)) {
                throw new ApiError('You blocked this contact. Unblock them to send a message.', 403);
            }
            if ($peer !== null && self::isBlocked($peer, $me)) {
                throw new ApiError("You can't send messages to this contact.", 403);
            }
            if ($peer !== null && Db::value("SELECT 1 FROM users WHERE id = ? AND phone LIKE 'deleted:%'", [$peer])) {
                throw new ApiError('This account was deleted.', 403);
            }
        }
        $recent = (int)Db::value("SELECT COUNT(*) FROM messages WHERE sender_id = ? AND created_at > ? AND kind <> 'system'", [$me, time() - 60]);
        if ($recent >= (int)cfg('limits.messages_per_minute', 40)) {
            throw new ApiError("You're sending messages too quickly. Please slow down.", 429);
        }
    }

    private static function replyId(int $me, array $c, int $replyTo): int
    {
        if ($replyTo <= 0) {
            return 0;
        }
        $m = Db::one('SELECT m.id FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
                       WHERE m.id = ? AND m.conversation_id = ? AND ' . self::VISIBLE, [$me, $replyTo, $c['id']]);
        return $m ? (int)$m['id'] : 0;
    }

    public static function send(int $me, int $cid, string $body, int $replyTo = 0): array
    {
        $body = clean_text($body, (int)cfg('limits.message_length', 4000), true);
        if ($body === '') {
            throw new ApiError('Type a message first.');
        }
        $c = self::conversation($me, $cid);
        self::checkCanSend($me, $c);
        $id = self::insertMessage($cid, $me, ['kind' => 'text', 'body' => $body, 'reply_to' => self::replyId($me, $c, $replyTo)]);
        return self::message($me, $id);
    }

    public static function sendLocation(int $me, int $cid, float $lat, float $lng, int $replyTo = 0): array
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            throw new ApiError('That location is not valid.');
        }
        $c = self::conversation($me, $cid);
        self::checkCanSend($me, $c);
        $id = self::insertMessage($cid, $me, [
            'kind' => 'location',
            'media' => json_encode(['lat' => round($lat, 6), 'lng' => round($lng, 6)]),
            'reply_to' => self::replyId($me, $c, $replyTo),
        ]);
        return self::message($me, $id);
    }

    public static function sendMedia(int $me, int $cid, array $file, string $want, string $caption, float $duration, int $replyTo = 0): array
    {
        $c = self::conversation($me, $cid);
        self::checkCanSend($me, $c);
        $stored = Media::storeAttachment($file, $want, $duration);
        $id = self::insertMessage($cid, $me, [
            'kind' => $stored['kind'],
            'body' => $stored['kind'] === 'voice' ? '' : clean_text($caption, 1000, true),
            'media_key' => $stored['key'],
            'media' => json_encode($stored['media'], JSON_UNESCAPED_UNICODE),
            'reply_to' => self::replyId($me, $c, $replyTo),
        ]);
        return self::message($me, $id);
    }

    // ------------------------------------------------------------------ editing, deleting, reacting, forwarding

    private static function visibleMessage(int $me, int $mid): array
    {
        $m = Db::one('SELECT m.* FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
                       WHERE m.id = ? AND ' . self::VISIBLE, [$me, $mid]);
        if (!$m) {
            throw new ApiError('Message not found.', 404);
        }
        return $m;
    }

    private static function logUpdate(int $cid, int $mid): void
    {
        Db::run('INSERT INTO message_updates (conversation_id, message_id, created_at) VALUES (?, ?, ?)', [$cid, $mid, time()]);
        if (random_int(1, 50) === 1) {
            Db::run('DELETE FROM message_updates WHERE created_at < ?', [time() - 7 * 86400]);
        }
    }

    public static function edit(int $me, int $mid, string $body): array
    {
        $m = self::visibleMessage($me, $mid);
        if ((int)$m['sender_id'] !== $me || $m['kind'] !== 'text' || (int)$m['deleted_at'] > 0) {
            throw new ApiError('You can only edit your own text messages.', 403);
        }
        if ((int)$m['created_at'] < time() - self::EDIT_WINDOW) {
            throw new ApiError('Messages can only be edited for 15 minutes after sending.', 403);
        }
        self::requireActive(self::conversation($me, (int)$m['conversation_id']));
        $body = clean_text($body, (int)cfg('limits.message_length', 4000), true);
        if ($body === '') {
            throw new ApiError('Type a message first.');
        }
        Db::run('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?', [$body, time(), $mid]);
        self::logUpdate((int)$m['conversation_id'], $mid);
        return self::message($me, $mid);
    }

    public static function delete(int $me, int $mid, bool $forEveryone): void
    {
        $m = self::visibleMessage($me, $mid);
        if (!$forEveryone) {
            try {
                Db::run('INSERT INTO message_hidden (message_id, user_id) VALUES (?, ?)', [$mid, $me]);
            } catch (Throwable $e) {
                if (!Db::isUniqueViolation($e)) {
                    throw $e;
                }
            }
            return;
        }
        if ($m['kind'] === 'system') {
            throw new ApiError("This message can't be deleted for everyone.", 403);
        }
        $c = self::conversation($me, (int)$m['conversation_id']);
        self::requireActive($c);
        $mine = (int)$m['sender_id'] === $me;
        if (!$mine && !($c['type'] === 'group' && $c['my_role'] === 'admin')) {
            throw new ApiError('You can only delete your own messages for everyone.', 403);
        }
        if ($mine && (int)$m['created_at'] < time() - self::DELETE_WINDOW) {
            throw new ApiError("It's too late to delete this message for everyone. You can still delete it for yourself.", 403);
        }
        if ((int)$m['deleted_at'] > 0) {
            return;
        }
        Db::tx(function () use ($m, $mid) {
            Db::run("UPDATE messages SET deleted_at = ?, body = '', media_key = '', media = '' WHERE id = ?", [time(), $mid]);
            Db::run('DELETE FROM message_reactions WHERE message_id = ?', [$mid]);
            self::logUpdate((int)$m['conversation_id'], $mid);
        });
        // Remove the file unless the same attachment was forwarded somewhere else.
        $key = (string)$m['media_key'];
        if ($key !== '' && !Db::value('SELECT 1 FROM messages WHERE media_key = ? LIMIT 1', [$key])) {
            $meta = json_decode((string)$m['media'], true) ?: [];
            @unlink(Media::path($key, (string)($meta['ext'] ?? 'dat')));
            @unlink(Media::path($key, '', true));
        }
    }

    public static function react(int $me, int $mid, string $emoji): array
    {
        $m = self::visibleMessage($me, $mid);
        if ($m['kind'] === 'system' || (int)$m['deleted_at'] > 0) {
            throw new ApiError("You can't react to this message.", 422);
        }
        self::requireActive(self::conversation($me, (int)$m['conversation_id']));
        $emoji = trim($emoji);
        if ($emoji !== '' && (strlen($emoji) > 32 || !preg_match('//u', $emoji) || str_length($emoji) > 10
            || preg_match('/[\p{L}\p{N}\s<>&"\'\\\\]/u', $emoji))) {
            throw new ApiError('Choose an emoji to react with.', 422);
        }
        Db::tx(function () use ($m, $mid, $me, $emoji) {
            Db::run('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [$mid, $me]);
            if ($emoji !== '') {
                Db::run('INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)', [$mid, $me, $emoji, time()]);
            }
            self::logUpdate((int)$m['conversation_id'], $mid);
        });
        return self::message($me, $mid);
    }

    public static function forward(int $me, int $mid, array $cids): int
    {
        $m = self::visibleMessage($me, $mid);
        if ($m['kind'] === 'system' || (int)$m['deleted_at'] > 0) {
            throw new ApiError("This message can't be forwarded.", 422);
        }
        $cids = array_values(array_unique(array_filter(array_map('intval', $cids))));
        if (!$cids) {
            throw new ApiError('Choose at least one chat.', 422);
        }
        if (count($cids) > 5) {
            throw new ApiError('You can forward to up to 5 chats at a time.', 422);
        }
        $n = 0;
        foreach ($cids as $cid) {
            $c = self::conversation($me, $cid);
            self::checkCanSend($me, $c);
            self::insertMessage($cid, $me, [
                'kind' => $m['kind'], 'body' => $m['body'], 'media_key' => $m['media_key'], 'media' => $m['media'], 'forwarded' => 1,
            ]);
            $n++;
        }
        return $n;
    }

    // ------------------------------------------------------------------ reading

    public static function messages(int $me, int $cid, int $before = 0, int $limit = 50): array
    {
        $c = self::conversation($me, $cid);
        $limit = max(1, min(100, $limit));
        $params = [$me, $cid];
        $sql = 'SELECT m.* FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
                WHERE m.conversation_id = ? AND ' . self::VISIBLE;
        if ($before > 0) {
            $sql .= ' AND m.id < ?';
            $params[] = $before;
        }
        $rows = array_reverse(Db::all($sql . " ORDER BY m.id DESC LIMIT {$limit}", $params));
        $last = (int)$c['last_message_id'];
        if ((int)$c['my_left_id'] > 0) {
            $last = min($last, (int)$c['my_left_id']);
        }
        self::markDelivered($me, $c, $last);
        return ['messages' => self::presentMessages($rows, $me), 'has_more' => count($rows) === $limit];
    }

    public static function search(int $me, int $cid, string $q): array
    {
        self::conversation($me, $cid);
        $q = clean_text($q, 100);
        if (str_length($q) < 2) {
            return [];
        }
        $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $q) . '%';
        $rows = Db::all("SELECT m.* FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
            WHERE m.conversation_id = ? AND m.deleted_at = 0 AND m.kind IN ('text', 'image', 'video', 'file')
              AND (m.body LIKE ? ESCAPE '!' OR m.media LIKE ? ESCAPE '!') AND " . self::VISIBLE . '
            ORDER BY m.id DESC LIMIT 50', [$me, $cid, $like, $like]);
        return self::presentMessages($rows, $me);
    }

    private static function markDelivered(int $me, array $c, int $upto): void
    {
        if ($upto > (int)$c['my_delivered_id']) {
            Db::run('UPDATE conversation_members SET delivered_id = ? WHERE conversation_id = ? AND user_id = ? AND delivered_id < ?', [$upto, $c['id'], $me, $upto]);
            Db::run('UPDATE conversations SET receipt_at = ? WHERE id = ?', [time(), $c['id']]);
        }
    }

    public static function markRead(int $me, int $cid, int $upto): void
    {
        $c = self::conversation($me, $cid);
        $upto = min($upto, (int)$c['last_message_id']);
        if ((int)$c['my_left_id'] > 0) {
            $upto = min($upto, (int)$c['my_left_id']);
        }
        if ($upto > (int)$c['my_read_id']) {
            Db::run('UPDATE conversation_members SET read_id = ?, delivered_id = CASE WHEN delivered_id < ? THEN ? ELSE delivered_id END
                     WHERE conversation_id = ? AND user_id = ?', [$upto, $upto, $upto, $cid, $me]);
            Db::run('UPDATE conversations SET receipt_at = ? WHERE id = ?', [time(), $cid]);
        }
    }

    public static function typing(int $me, int $cid): void
    {
        $c = self::conversation($me, $cid);
        self::requireActive($c);
        Db::run('UPDATE conversation_members SET typing_at = ? WHERE conversation_id = ? AND user_id = ?', [time(), $cid, $me]);
    }

    /** Pin, mute and archive are personal: they only change this person's view. */
    public static function settings(int $me, int $cid, array $in): array
    {
        $c = self::conversation($me, $cid);
        if (array_key_exists('pinned', $in)) {
            $pin = (bool)$in['pinned'];
            if ($pin && (int)$c['my_pinned_at'] === 0) {
                $count = (int)Db::value('SELECT COUNT(*) FROM conversation_members WHERE user_id = ? AND pinned_at > 0 AND hidden = 0', [$me]);
                if ($count >= self::MAX_PINNED) {
                    throw new ApiError('You can pin up to ' . self::MAX_PINNED . ' chats.', 422);
                }
            }
            Db::run('UPDATE conversation_members SET pinned_at = ?, archived = CASE WHEN ? > 0 THEN 0 ELSE archived END WHERE conversation_id = ? AND user_id = ?',
                [$pin ? time() : 0, $pin ? 1 : 0, $cid, $me]);
        }
        if (array_key_exists('archived', $in)) {
            $arch = (bool)$in['archived'];
            Db::run('UPDATE conversation_members SET archived = ?, pinned_at = CASE WHEN ? > 0 THEN 0 ELSE pinned_at END WHERE conversation_id = ? AND user_id = ?',
                [$arch ? 1 : 0, $arch ? 1 : 0, $cid, $me]);
        }
        if (array_key_exists('mute', $in)) {
            $until = match ((string)$in['mute']) {
                '8h' => time() + 8 * 3600,
                '1w' => time() + 7 * 86400,
                'always' => self::MUTE_ALWAYS,
                'off' => 0,
                default => throw new ApiError('Choose how long to mute this chat.', 422),
            };
            Db::run('UPDATE conversation_members SET muted_until = ? WHERE conversation_id = ? AND user_id = ?', [$until, $cid, $me]);
        }
        return self::one($me, $cid);
    }

    /** Deletes the chat from this person's list and clears its history for them only. */
    public static function deleteChat(int $me, int $cid): void
    {
        $c = self::conversation($me, $cid);
        if ($c['type'] === 'group' && (int)$c['my_left_id'] === 0) {
            throw new ApiError('Exit the group before deleting it.', 422);
        }
        $last = (int)$c['my_left_id'] > 0 ? min((int)$c['last_message_id'], (int)$c['my_left_id']) : (int)$c['last_message_id'];
        Db::run('UPDATE conversation_members SET cleared_id = ?, read_id = CASE WHEN read_id < ? THEN ? ELSE read_id END,
                 hidden = 1, pinned_at = 0, archived = 0 WHERE conversation_id = ? AND user_id = ?', [$last, $last, $last, $cid, $me]);
    }

    public static function setBlocked(int $me, int $cid, bool $block): void
    {
        $c = self::conversation($me, $cid);
        if ($c['type'] !== 'direct') {
            throw new ApiError('Only people can be blocked. To stop group messages, exit the group or mute it.', 422);
        }
        $peer = self::directPeer($cid, $me);
        if ($peer === null) {
            return;
        }
        if ($block && !self::isBlocked($me, $peer)) {
            Db::run('INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [$me, $peer, time()]);
        } elseif (!$block) {
            Db::run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [$me, $peer]);
        }
    }

    // ------------------------------------------------------------------ polling

    /**
     * Everything an open app needs every few seconds.
     *  $since  = highest message id the app has, $rsince = server time of its previous poll,
     *  $useq   = last message-update sequence it has seen (edits, deletions, reactions).
     */
    public static function poll(int $me, int $since, int $rsince, int $useq): array
    {
        $now = time();
        $rows = Db::all('SELECT m.* FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
                         WHERE m.id > ? AND ' . self::VISIBLE . ' ORDER BY m.id ASC LIMIT 300', [$me, $since]);
        $incoming = [];
        foreach ($rows as $m) {
            if ((int)$m['sender_id'] !== $me) {
                $incoming[(int)$m['conversation_id']] = max($incoming[(int)$m['conversation_id']] ?? 0, (int)$m['id']);
            }
        }
        foreach ($incoming as $cid => $maxId) {
            Db::run('UPDATE conversation_members SET delivered_id = ? WHERE conversation_id = ? AND user_id = ? AND delivered_id < ?', [$maxId, $cid, $me, $maxId]);
            Db::run('UPDATE conversations SET receipt_at = ? WHERE id = ?', [$now, $cid]);
        }

        $updated = [];
        $newUseq = $useq;
        foreach (Db::all('SELECT u.id AS upd_id, m.* FROM message_updates u
                          JOIN conversation_members cm ON cm.conversation_id = u.conversation_id AND cm.user_id = ?
                          JOIN messages m ON m.id = u.message_id
                          WHERE u.id > ? AND ' . self::VISIBLE . ' ORDER BY u.id ASC LIMIT 300', [$me, $useq]) as $r) {
            $newUseq = max($newUseq, (int)$r['upd_id']);
            unset($r['upd_id']);
            $updated[(int)$r['id']] = $r;
        }

        $receipts = [];
        foreach (Db::all('SELECT c.id,
                (SELECT MIN(o.read_id) FROM conversation_members o WHERE o.conversation_id = c.id AND o.user_id <> ? AND o.left_id = 0) AS r,
                (SELECT MIN(o.delivered_id) FROM conversation_members o WHERE o.conversation_id = c.id AND o.user_id <> ? AND o.left_id = 0) AS d
            FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
            WHERE c.receipt_at >= ?', [$me, $me, $me, max(0, $rsince)]) as $r) {
            $receipts[] = ['chat' => (int)$r['id'], 'peer_read_id' => (int)$r['r'], 'peer_delivered_id' => (int)$r['d']];
        }

        $typingRows = Db::all('SELECT o.conversation_id, o.user_id FROM conversation_members cm
            JOIN conversation_members o ON o.conversation_id = cm.conversation_id
            WHERE cm.user_id = ? AND cm.left_id = 0 AND o.user_id <> ? AND o.left_id = 0 AND o.typing_at >= ?', [$me, $me, $now - self::TYPING_WINDOW]);
        $typers = self::users(array_column($typingRows, 'user_id'));
        $typing = array_map(fn($t) => [
            'chat' => (int)$t['conversation_id'], 'user_id' => (int)$t['user_id'], 'name' => self::personName($typers[(int)$t['user_id']] ?? null),
        ], $typingRows);

        if ((int)Db::value('SELECT last_seen_at FROM users WHERE id = ?', [$me]) < $now - 20) {
            Db::run('UPDATE users SET last_seen_at = ? WHERE id = ?', [$now, $me]);
        }

        return [
            'now' => $now,
            'messages' => self::presentMessages($rows, $me),
            'updates' => self::presentMessages(array_values($updated), $me),
            'useq' => $newUseq,
            'receipts' => $receipts,
            'typing' => $typing,
            'has_more' => count($rows) === 300,
        ];
    }

    public static function currentUseq(): int
    {
        return (int)(Db::value('SELECT MAX(id) FROM message_updates') ?? 0);
    }
}
