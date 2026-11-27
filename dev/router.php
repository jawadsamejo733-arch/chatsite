<?php
/**
 * Router for PHP's built-in server, mimicking public_html/.htaccess:
 *   php -S localhost:8080 -t public_html dev/router.php
 * With no app/config.php it runs in development mode: SQLite database, login codes shown on screen.
 */
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$root = $_SERVER['DOCUMENT_ROOT'];

if (preg_match('#^/(app|storage)(/|$)#', $path) || preg_match('#/\.#', $path)) {
    http_response_code(403);
    echo 'Forbidden';
    return true;
}
if (preg_match('#^/s(/|$)#', $path)) {
    $_SERVER['SCRIPT_NAME'] = '/site.php';
    require $root . '/site.php';
    return true;
}
if ($path === '/' || $path === '/index.php') {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    require $root . '/index.php';
    return true;
}
if (is_file($root . $path)) {
    if (str_ends_with($path, '.webmanifest')) {
        header('Content-Type: application/manifest+json');
        readfile($root . $path);
        return true;
    }
    return false; // let the built-in server serve static files / run PHP files
}
http_response_code(404);
echo 'Not found';
return true;
