<?php
/**
 * Serves chat attachments (?k=<key>, thumbnails with &t=1) to members of a chat that contains them,
 * and profile/group photos (?a=<key>) to signed-in users.
 */
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

function media_not_found(int $status = 404): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $status === 403 ? 'Sign in to view this file.' : 'Not found.';
    exit;
}

if (!cfg('installed')) {
    media_not_found();
}
Auth::startSession();
$uid = Auth::userId();
session_write_close();
if (!$uid) {
    media_not_found(403);
}

if (isset($_GET['a'])) {
    $key = (string)$_GET['a'];
    $file = storage_path('avatars/' . $key . '.jpg');
    if (!preg_match('/^[a-f0-9]{24}$/', $key) || !is_file($file)) {
        media_not_found();
    }
    Media::stream($file, 'image/jpeg', 'inline');
}

$key = (string)($_GET['k'] ?? '');
if (!preg_match('/^[a-f0-9]{24}$/', $key)) {
    media_not_found();
}
$row = Db::one(
    'SELECT m.media FROM messages m
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     WHERE m.media_key = ? AND m.deleted_at = 0 AND m.id > cm.cleared_id AND (cm.left_id = 0 OR m.id <= cm.left_id)
     LIMIT 1',
    [$uid, $key]
);
$meta = $row ? json_decode((string)$row['media'], true) : null;
if (!is_array($meta)) {
    media_not_found();
}
$ext = (string)($meta['ext'] ?? '');
$thumb = !empty($_GET['t']) && !empty($meta['thumb']);
$file = Media::path($key, $ext, $thumb);
if (!preg_match('/^[a-z0-9]{1,8}$/', $ext) || !is_file($file)) {
    media_not_found();
}
$mime = $thumb ? 'image/jpeg' : (string)($meta['mime'] ?? 'application/octet-stream');
$inline = (bool)preg_match('#^(image/(jpeg|png|webp|gif)|audio/[a-z0-9.+-]+|video/(mp4|webm|quicktime|3gpp))$#', $mime);
if ($inline) {
    Media::stream($file, $mime, 'inline');
}
Media::stream($file, 'application/octet-stream', 'attachment', (string)($meta['name'] ?? 'file'));
