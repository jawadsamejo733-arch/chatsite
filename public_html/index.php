<?php
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

if (!cfg('installed')) {
    header('Location: install.php');
    exit;
}
send_security_headers('app');
header('Cache-Control: no-cache');
$name = e(cfg('app_name'));
$v = e(CHATSITE_VERSION);
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#4f46e5">
<meta name="description" content="Chat with businesses and browse their mini-sites, all in one place.">
<title><?= $name ?></title>
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="assets/app.css?v=<?= $v ?>">
<script src="assets/app.js?v=<?= $v ?>" defer></script>
</head>
<body>
<div id="root" class="boot"><div class="boot-logo"><img src="assets/icon.svg" alt="" width="64" height="64"><p><?= $name ?></p></div></div>
<noscript>Please enable JavaScript to use <?= $name ?>.</noscript>
</body>
</html>
