<?php
declare(strict_types=1);

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('ChatSite needs PHP 8.1 or newer. In cPanel open "Select PHP Version" (or "MultiPHP Manager") and choose PHP 8.1, 8.2 or 8.3.');
}

define('CHATSITE', true);
define('CHATSITE_VERSION', '1.0.0');
define('APP_DIR', __DIR__);
define('PUBLIC_DIR', dirname(__DIR__));

require APP_DIR . '/lib/helpers.php';
require APP_DIR . '/lib/Db.php';
require APP_DIR . '/lib/Sms.php';
require APP_DIR . '/lib/Auth.php';
require APP_DIR . '/lib/Chat.php';
require APP_DIR . '/lib/Sites.php';

date_default_timezone_set('UTC');
$GLOBALS['CHATSITE_CONFIG'] = load_config();

ini_set('display_errors', '0');
ini_set('log_errors', '1');
if (is_dir(storage_path()) && is_writable(storage_path())) {
    ensure_dir(storage_path('logs'));
    ini_set('error_log', storage_path('logs/php-error.log'));
}
