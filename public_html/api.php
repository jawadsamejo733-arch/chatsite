<?php
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';
require APP_DIR . '/lib/Api.php';

send_security_headers('api');
Api::handle((string)($_GET['r'] ?? ''));
