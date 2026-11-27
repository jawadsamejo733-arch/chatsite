<?php
/**
 * Serves mini-sites at /s/<slug>/<path>. Every response carries a CSP "sandbox" header, so even
 * uploaded JavaScript runs in a unique, isolated origin with no access to the chat app.
 */
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

function site_error(int $status, string $title, string $text): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Security-Policy: sandbox; default-src \'none\'; style-src \'unsafe-inline\'');
    header('X-Content-Type-Options: nosniff');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . e($title) . '</title>'
        . '<style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#555;background:#f7f7fa;text-align:center;padding:16px}'
        . '@media(prefers-color-scheme:dark){body{background:#111217;color:#aaa}}h1{font-size:22px;color:inherit}</style>'
        . '<div><h1>' . e($title) . '</h1><p>' . e($text) . '</p></div>';
    exit;
}

if (!cfg('installed')) {
    site_error(503, 'Not ready yet', 'This website is being set up.');
}

// Work out /s/<slug>/<rest> from the request URI (works with or without mod_rewrite via site.php/<slug>/...).
$uriPath = rawurldecode((string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));
$base = base_path();
$rest = str_starts_with($uriPath, $base) ? substr($uriPath, strlen($base)) : ltrim($uriPath, '/');
if (str_starts_with($rest, 'site.php')) {
    $rest = 's' . substr($rest, strlen('site.php'));
}
if (!preg_match('#^s/([a-z0-9-]{3,40})(/.*)?$#', $rest, $m)) {
    site_error(404, 'Page not found', 'This address does not exist.');
}
$slug = $m[1];
$path = isset($m[2]) ? ltrim($m[2], '/') : null;
if ($path === null) {
    header('Location: ' . Sites::url($slug) . (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : ''), true, 301);
    exit;
}
if (str_contains($path, "\0") || preg_match('#(^|/)\.#', $path)) {
    site_error(404, 'Page not found', 'This page does not exist.');
}

$site = Sites::bySlug($slug);
if (!$site) {
    site_error(404, 'Site not found', 'There is no website at this address.');
}
$uid = (int)$site['user_id'];
$preview = Sites::checkPreviewToken((string)($_GET['preview'] ?? ''), $uid, $slug);

$sandbox = 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function send_file(string $file, string $type, string $sandbox, bool $cacheable): never
{
    $etag = '"' . substr(md5($file . '|' . filemtime($file) . '|' . filesize($file)), 0, 16) . '"';
    header('Content-Type: ' . $type);
    header('Content-Security-Policy: ' . $sandbox);
    header('ETag: ' . $etag);
    header('Cache-Control: ' . ($cacheable ? 'public, max-age=86400' : 'no-cache'));
    if (trim((string)($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

// Uploaded images for template sites.
if (preg_match('#^media/([a-f0-9]{24}\.(jpg|png|webp|gif))$#', $path, $mm)) {
    $file = Sites::dir($uid, 'media') . '/' . $mm[1];
    if (!is_file($file)) {
        site_error(404, 'Not found', 'This image does not exist.');
    }
    send_file($file, Sites::CUSTOM_TYPES[$mm[2]], $sandbox, true);
}

$ext = strtolower(pathinfo($path === '' || str_ends_with($path, '/') ? $path . 'index.html' : $path, PATHINFO_EXTENSION));
$isPage = $path === '' || str_ends_with($path, '/') || in_array($ext, ['html', 'htm'], true);
if ($isPage && !(int)$site['published'] && !$preview) {
    site_error(404, 'Coming soon', 'This website has not been published yet.');
}

if ($site['mode'] === 'template') {
    if ($path !== '' && $path !== 'index.html') {
        site_error(404, 'Page not found', 'This page does not exist.');
    }
    $owner = Db::one('SELECT * FROM users WHERE id = ?', [$uid]) ?? [];
    $data = json_decode((string)$site['data'], true) ?: [];
    $html = Sites::render((string)$site['template'], $data, $owner, $slug);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header("Content-Security-Policy: {$sandbox}; default-src 'none'; img-src * data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    echo $html;
    exit;
}

// Custom uploaded website.
$root = realpath(Sites::dir($uid, 'custom'));
if ($root === false) {
    site_error(404, 'Coming soon', 'This website has no files yet.');
}
$rel = $path === '' || str_ends_with($path, '/') ? $path . 'index.html' : $path;
$file = realpath($root . '/' . $rel);
if ($file !== false && is_dir($file) && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file . '/index.html')) {
    // Folder without trailing slash: redirect so relative links inside it resolve correctly.
    header('Location: ' . Sites::url($slug) . $rel . '/' . (($_SERVER['QUERY_STRING'] ?? '') !== '' ? '?' . $_SERVER['QUERY_STRING'] : ''), true, 301);
    exit;
}
if ($file === false && !str_contains(basename($rel), '.')) {
    $file = realpath($root . '/' . $rel . '.html') ?: false;
}
if ($file === false || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
    site_error(404, 'Page not found', 'This page does not exist.');
}
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$type = Sites::CUSTOM_TYPES[$ext] ?? null;
if ($type === null) {
    site_error(404, 'Page not found', 'This file type is not served.');
}
if (in_array($ext, ['html', 'htm'], true)) {
    if (!(int)$site['published'] && !$preview) {
        site_error(404, 'Coming soon', 'This website has not been published yet.');
    }
    // Give custom code the same "message the business" bridge the templates use: ChatSite.compose("text").
    $bridge = '<script>window.ChatSite={compose:function(t){t=String(t||"");if(window.parent!==window){window.parent.postMessage({type:"chatsite:compose",text:t},"*")}else{location.href='
        . json_encode(base_path(), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES) . '+"#/to/"+' . json_encode($slug) . '+"?text="+encodeURIComponent(t)}}};</script>';
    $html = (string)file_get_contents($file);
    $count = 0;
    $html = (string)preg_replace_callback('/<head(\s[^>]*)?>/i', fn($mt) => $mt[0] . $bridge, $html, 1, $count);
    if ($count === 0) {
        $html = $bridge . $html;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Security-Policy: ' . $sandbox);
    header('Cache-Control: no-cache');
    echo $html;
    exit;
}
send_file($file, $type, $sandbox, false);
