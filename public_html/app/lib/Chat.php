<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/**
 * One-to-one conversations. Read/delivered receipts are stored as per-member
 * "high-water marks" on the conversation row, so a tick update is one row write.
 */
final class Chat
{
    public const ONLINE_WINDOW = 45;

    public static function presentUser(array $u, ?array $site = null): array
    {
        $now = time();
        $out = [
            'id' => (int)$u['id'],
            'phone' => (string)$u['phone'],
            'name' => (string)$u['name'],
            'business_name' => (string)$u['business_name'],
            'about' => (string)$u['about'],
            'display_name' => self::displayName($u),
            'online' => (int)$u['last_seen_at'] >= $now - self::ONLINE_WINDOW,
            'last_seen_at' => (int)$u['last_seen_at'],
            'site' => null,
        ];
        if ($site && Sites::isLive($site)) {
            $out['site'] = ['slug' => (string)$site['slug'], 'url' => Sites::url((string)$site['slug'])];
        }
        return $out;
    }

    public static function displayName(array $u): string
    {
        foreach (['business_name', 'name', 'phone'] as $k) {
            if (trim((string)($u[$k] ?? '')) !== '') {
                return (string)$u[$k];
            }
        }
        return 'Unknown';
    }

    private static function side(array $conv, int $me): string
    {
        return (int)$conv['user_a'] === $me ? 'a' : 'b';
    }

    private static function peerId(array $conv, int $me): int
    {
        return (int)$conv['user_a'] === $me ? (int)$conv['user_b'] : (int)$conv['user_a'];
    }

    public static function conversation(int $me, int $cid): array
    {
        $c = Db::one('SELECT * FROM conversations WHERE id = ? AND (user_a = ? OR user_b = ?)', [$cid, $me, $me]);
        if (!$c) {
            throw new ApiError('Chat not found.', 404);
        }
        return $c;
    }

    public static function isBlocked(int $blocker, int $blocked): bool
    {
        return (bool)Db::value('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [$blocker, $blocked]);
    }

    public static function open(int $me, int $peer): array
    {
        if ($me === $peer) {
            throw new ApiError("That's your own number.");
        }
        [$a, $b] = $me < $peer ? [$me, $peer] : [$peer, $me];
        $c = Db::one('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?', [$a, $b]);
        if ($c) {
            return $c;
        }
        $now = time();
        try {
            Db::insert(
                'INSERT INTO conversations (user_a, user_b, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                [$a, $b, $me, $now, $now]
            );
        } catch (Throwable $e) {
            if (!Db::isUniqueViolation($e)) {
                throw $e;
            }
        }
        return Db::one('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?', [$a, $b]);
    }

    public static function present(array $c, int $me, array $peer, ?array $site, ?array $last, int $unread): array
    {
        $side = self::side($c, $me);
        $other = $side === 'a' ? 'b' : 'a';
        return [
            'id' => (int)$c['id'],
            'peer' => self::presentUser($peer, $site),
            'unread' => $unread,
            'updated_at' => (int)$c['updated_at'],
            'peer_read_id' => (int)$c[$other . '_read_id'],
            'peer_delivered_id' => (int)$c[$other . '_delivered_id'],
            'blocked' => self::isBlocked($me, (int)$peer['id']),
            'last' => $last ? [
                'id' => (int)$last['id'],
                'body' => str_cut((string)$last['body'], 120),
                'mine' => (int)$last['sender_id'] === $me,
                'created_at' => (int)$last['created_at'],
            ] : null,
        ];
    }

    public static function list(int $me): array
    {
        $rows = Db::all(
            'SELECT c.*, u.id AS p_id, u.phone AS p_phone, u.name AS p_name, u.business_name AS p_business_name,
                    u.about AS p_about, u.last_seen_at AS p_last_seen_at,
                    m.id AS m_id, m.body AS m_body, m.sender_id AS m_sender_id, m.created_at AS m_created_at,
                    s.slug AS s_slug, s.mode AS s_mode, s.published AS s_published, s.custom_files AS s_custom_files
             FROM conversations c
             JOIN users u ON u.id = (CASE WHEN c.user_a = :me1 THEN c.user_b ELSE c.user_a END)
             LEFT JOIN messages m ON m.id = c.last_message_id
             LEFT JOIN sites s ON s.user_id = u.id
             WHERE (c.user_a = :me2 OR c.user_b = :me3) AND (c.last_message_id > 0 OR c.created_by = :me4)
             ORDER BY c.updated_at DESC, c.id DESC
             LIMIT 500',
            ['me1' => $me, 'me2' => $me, 'me3' => $me, 'me4' => $me]
        );
        $unread = self::unreadCounts($me);
        $out = [];
        foreach ($rows as $r) {
            $peer = ['id' => $r['p_id'], 'phone' => $r['p_phone'], 'name' => $r['p_name'],
                'business_name' => $r['p_business_name'], 'about' => $r['p_about'], 'last_seen_at' => $r['p_last_seen_at']];
            $site = $r['s_slug'] !== null ? ['slug' => $r['s_slug'], 'mode' => $r['s_mode'],
                'published' => $r['s_published'], 'custom_files' => $r['s_custom_files']] : null;
            $last = $r['m_id'] !== null ? ['id' => $r['m_id'], 'body' => $r['m_body'],
                'sender_id' => $r['m_sender_id'], 'created_at' => $r['m_created_at']] : null;
            $out[] = self::present($r, $me, $peer, $site, $last, $unread[(int)$r['id']] ?? 0);
        }
        return $out;
    }

    public static function one(int $me, int $cid): array
    {
        $c = self::conversation($me, $cid);
        $peerId = self::peerId($c, $me);
        $peer = Db::one('SELECT * FROM users WHERE id = ?', [$peerId]);
        $site = Db::one('SELECT * FROM sites WHERE user_id = ?', [$peerId]);
        $last = (int)$c['last_message_id'] > 0 ? Db::one('SELECT * FROM messages WHERE id = ?', [$c['last_message_id']]) : null;
        return self::present($c, $me, $peer, $site, $last, self::unreadCounts($me, $cid)[$cid] ?? 0);
    }

    /** @return array<int,int> conversation id => unread count */
    private static function unreadCounts(int $me, ?int $onlyCid = null): array
    {
        $sql = 'SELECT m.conversation_id AS cid, COUNT(*) AS n
                FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE m.sender_id <> :me1
                  AND ((c.user_a = :me2 AND m.id > c.a_read_id) OR (c.user_b = :me3 AND m.id > c.b_read_id))';
        $params = ['me1' => $me, 'me2' => $me, 'me3' => $me];
        if ($onlyCid !== null) {
            $sql .= ' AND c.id = :cid';
            $params['cid'] = $onlyCid;
        }
        $out = [];
        foreach (Db::all($sql . ' GROUP BY m.conversation_id', $params) as $r) {
            $out[(int)$r['cid']] = (int)$r['n'];
        }
        return $out;
    }

    public static function presentMessage(array $m): array
    {
        return [
            'id' => (int)$m['id'],
            'chat' => (int)$m['conversation_id'],
            'sender' => (int)$m['sender_id'],
            'body' => (string)$m['body'],
            'created_at' => (int)$m['created_at'],
        ];
    }

    public static function messages(int $me, int $cid, int $before = 0, int $limit = 50): array
    {
        $c = self::conversation($me, $cid);
        $limit = max(1, min(100, $limit));
        $rows = $before > 0
            ? Db::all("SELECT * FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT {$limit}", [$cid, $before])
            : Db::all("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT {$limit}", [$cid]);
        $rows = array_reverse($rows);
        self::markDelivered($me, $c, (int)$c['last_message_id']);
        return [
            'messages' => array_map([self::class, 'presentMessage'], $rows),
            'has_more' => count($rows) === $limit,
        ];
    }

    public static function send(int $me, int $cid, string $body): array
    {
        $body = clean_text($body, (int)cfg('limits.message_length', 4000), true);
        if ($body === '') {
            throw new ApiError('Type a message first.');
        }
        $c = self::conversation($me, $cid);
        $peer = self::peerId($c, $me);
        if (self::isBlocked($me, $peer)) {
            throw new ApiError('You blocked this contact. Unblock them to send a message.', 403);
        }
        if (self::isBlocked($peer, $me)) {
            throw new ApiError("You can't send messages to this contact.", 403);
        }
        $now = time();
        $recent = (int)Db::value('SELECT COUNT(*) FROM messages WHERE sender_id = ? AND created_at > ?', [$me, $now - 60]);
        if ($recent >= (int)cfg('limits.messages_per_minute', 40)) {
            throw new ApiError("You're sending messages too quickly. Please slow down.", 429);
        }
        $side = self::side($c, $me);
        $id = Db::tx(function () use ($cid, $me, $body, $now, $side) {
            $id = Db::insert('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', [$cid, $me, $body, $now]);
            Db::run(
                "UPDATE conversations SET last_message_id = ?, updated_at = ?, {$side}_read_id = ?, {$side}_delivered_id = ? WHERE id = ?",
                [$id, $now, $id, $id, $cid]
            );
            return $id;
        });
        return self::presentMessage(Db::one('SELECT * FROM messages WHERE id = ?', [$id]));
    }

    private static function markDelivered(int $me, array $c, int $upto): void
    {
        $side = self::side($c, $me);
        if ($upto > (int)$c[$side . '_delivered_id']) {
            Db::run(
                "UPDATE conversations SET {$side}_delivered_id = ?, receipt_at = ? WHERE id = ? AND {$side}_delivered_id < ?",
                [$upto, time(), $c['id'], $upto]
            );
        }
    }

    public static function markRead(int $me, int $cid, int $upto): void
    {
        $c = self::conversation($me, $cid);
        $upto = min($upto, (int)$c['last_message_id']);
        $side = self::side($c, $me);
        if ($upto > (int)$c[$side . '_read_id']) {
            Db::run(
                "UPDATE conversations SET {$side}_read_id = ?, {$side}_delivered_id = CASE WHEN {$side}_delivered_id < ? THEN ? ELSE {$side}_delivered_id END, receipt_at = ? WHERE id = ?",
                [$upto, $upto, $upto, time(), $cid]
            );
        }
    }

    /**
     * Everything the client needs every few seconds: new messages, receipt changes and presence.
     * $since = highest message id the client has; $rsince = server time of the previous poll.
     */
    public static function poll(int $me, int $since, int $rsince): array
    {
        $now = time();
        $rows = Db::all(
            'SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id
             WHERE m.id > :since AND (c.user_a = :me1 OR c.user_b = :me2)
             ORDER BY m.id ASC LIMIT 300',
            ['since' => $since, 'me1' => $me, 'me2' => $me]
        );

        $incomingMax = [];
        foreach ($rows as $m) {
            if ((int)$m['sender_id'] !== $me) {
                $incomingMax[(int)$m['conversation_id']] = max($incomingMax[(int)$m['conversation_id']] ?? 0, (int)$m['id']);
            }
        }
        foreach ($incomingMax as $cid => $maxId) {
            self::markDelivered($me, self::conversation($me, $cid), $maxId);
        }

        $receipts = [];
        foreach (Db::all(
            'SELECT * FROM conversations WHERE (user_a = :me1 OR user_b = :me2) AND receipt_at >= :rs',
            ['me1' => $me, 'me2' => $me, 'rs' => max(0, $rsince)]
        ) as $c) {
            $other = self::side($c, $me) === 'a' ? 'b' : 'a';
            $receipts[] = [
                'chat' => (int)$c['id'],
                'peer_read_id' => (int)$c[$other . '_read_id'],
                'peer_delivered_id' => (int)$c[$other . '_delivered_id'],
            ];
        }

        $last = (int)Db::value('SELECT last_seen_at FROM users WHERE id = ?', [$me]);
        if ($last < $now - 20) {
            Db::run('UPDATE users SET last_seen_at = ? WHERE id = ?', [$now, $me]);
        }

        return [
            'now' => $now,
            'messages' => array_map([self::class, 'presentMessage'], $rows),
            'receipts' => $receipts,
            'has_more' => count($rows) === 300,
        ];
    }

    public static function setBlocked(int $me, int $cid, bool $block): void
    {
        $c = self::conversation($me, $cid);
        $peer = self::peerId($c, $me);
        if ($block) {
            if (!self::isBlocked($me, $peer)) {
                Db::run('INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [$me, $peer, time()]);
            }
        } else {
            Db::run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [$me, $peer]);
        }
    }
}
