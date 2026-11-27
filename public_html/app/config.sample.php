<?php
/**
 * ChatSite configuration. install.php writes app/config.php for you; this file documents every option.
 * To configure by hand: copy this file to app/config.php and fill it in.
 */
return [
    'app_name' => 'ChatSite',

    // 'production' for your live site. 'development' shows login codes on screen (never use it publicly).
    'env' => 'production',

    // A long random string. Generate one with: php -r "echo bin2hex(random_bytes(32));"
    'app_secret' => 'CHANGE-ME-to-64-random-hex-characters',

    // GoDaddy cPanel: host is usually "localhost"; names are prefixed with your cPanel user.
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=cpaneluser_chatsite;charset=utf8mb4',
        'user' => 'cpaneluser_chat',
        'pass' => 'your-database-password',
    ],

    // Used when someone types a local number without "+": 1 = US/Canada, 44 = UK, 92 = Pakistan, 91 = India …
    'default_country_code' => '1',

    // How long people stay signed in.
    'session_days' => 30,

    'sms' => [
        'driver' => 'twilio', // twilio | http | log

        'twilio' => [
            'sid' => 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'token' => 'your-auth-token',
            'from' => '+15551234567',          // a Twilio number, or leave '' and set:
            'messaging_service_sid' => '',      // 'MGxxxxxxxx…' (recommended for international sending)
        ],

        // Any gateway with an HTTP API. Placeholders: {phone} (+923001234567), {phone_digits} (923001234567), {message}.
        'http' => [
            'url' => 'https://sms.example.com/api/send',
            'method' => 'POST',        // POST or GET
            'json' => false,           // true = send params as a JSON body
            'headers' => ['Authorization' => 'Bearer your-gateway-api-key'],
            'params' => ['to' => '{phone_digits}', 'text' => '{message}', 'sender' => 'ChatSite'],
        ],
    ],

    // Optional fixed codes for demo/review accounts (no SMS sent), e.g. for app-store reviewers.
    'test_numbers' => [
        // '+15550001111' => '424242',
    ],

    'otp' => ['ttl' => 600, 'max_attempts' => 5, 'resend_after' => 45, 'per_phone_hour' => 5, 'per_ip_hour' => 20],

    'limits' => [
        'message_length' => 4000,
        'messages_per_minute' => 40,
        'custom_upload_mb' => 10,     // also raise upload_max_filesize in .user.ini if you increase this
        'custom_unpacked_mb' => 30,
        'custom_files' => 300,
        'paste_kb' => 1500,           // largest website code that can be pasted into the app
        'image_mb' => 4,              // photos on template mini-sites
        'media_files' => 200,
        'photo_mb' => 10,             // photos sent in chats
        'file_mb' => 15,              // videos, voice messages, documents (keep below upload_max_filesize)
    ],
];
