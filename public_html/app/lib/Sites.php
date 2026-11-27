<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/**
 * Each account owns one mini-site, built from a template or uploaded as custom HTML/CSS/JS.
 * All site pages are served with "Content-Security-Policy: sandbox", so uploaded code runs in an
 * isolated origin and can never read the chat app's cookies, session or messages.
 */
final class Sites
{
    public const TEMPLATES = [
        'shop' => ['name' => 'Online shop', 'items' => 'Products', 'cta' => "I'd like to order", 'accent' => '#4f46e5'],
        'menu' => ['name' => 'Restaurant menu', 'items' => 'Menu items', 'cta' => "I'd like to order", 'accent' => '#c2410c'],
        'services' => ['name' => 'Services & booking', 'items' => 'Services', 'cta' => "I'd like to book", 'accent' => '#0f766e'],
        'links' => ['name' => 'Profile & links', 'items' => 'Highlights', 'cta' => "I'm interested in", 'accent' => '#be185d'],
    ];

    private const RESERVED = ['api', 'app', 'admin', 'assets', 'install', 'login', 'www', 'mail', 'help', 'support',
        'static', 'storage', 'site', 'sites', 'chat', 'about', 'terms', 'privacy', 'root', 'test'];

    public const CUSTOM_TYPES = [
        'html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8',
        'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8',
        'json' => 'application/json', 'txt' => 'text/plain; charset=utf-8', 'xml' => 'application/xml', 'map' => 'application/json',
        'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif',
        'webp' => 'image/webp', 'avif' => 'image/avif', 'ico' => 'image/x-icon',
        'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'otf' => 'font/otf',
        'mp3' => 'audio/mpeg', 'ogg' => 'audio/ogg', 'wav' => 'audio/wav', 'mp4' => 'video/mp4', 'webm' => 'video/webm',
        'pdf' => 'application/pdf', 'webmanifest' => 'application/manifest+json',
    ];

    private const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public static function url(string $slug): string
    {
        return base_path() . 's/' . $slug . '/';
    }

    public static function isLive(array $site): bool
    {
        if (!(int)$site['published']) {
            return false;
        }
        return $site['mode'] !== 'custom' || (int)$site['custom_files'] > 0;
    }

    public static function dir(int $uid, string $sub = ''): string
    {
        return storage_path('sites/' . $uid . ($sub === '' ? '' : '/' . $sub));
    }

    public static function bySlug(string $slug): ?array
    {
        return Db::one('SELECT * FROM sites WHERE slug = ?', [strtolower($slug)]);
    }

    public static function forUser(int $uid): array
    {
        $site = Db::one('SELECT * FROM sites WHERE user_id = ?', [$uid]);
        if ($site) {
            return $site;
        }
        $user = Db::one('SELECT * FROM users WHERE id = ?', [$uid]) ?? [];
        $base = self::slugify((string)($user['business_name'] ?: $user['name'] ?: ''));
        if (strlen($base) < 3) {
            $base = 'shop-' . $uid;
        }
        $slug = $base;
        for ($i = 2; self::slugTaken($slug, $uid) || in_array($slug, self::RESERVED, true); $i++) {
            $slug = substr($base, 0, 34) . '-' . $i;
        }
        $data = self::defaults($user);
        try {
            Db::run(
                'INSERT INTO sites (user_id, slug, mode, template, data, published, custom_files, custom_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)',
                [$uid, $slug, 'template', 'shop', json_encode($data, JSON_UNESCAPED_UNICODE), time()]
            );
        } catch (Throwable $e) {
            if (!Db::isUniqueViolation($e)) {
                throw $e;
            }
        }
        return Db::one('SELECT * FROM sites WHERE user_id = ?', [$uid]) ?? throw new RuntimeException('Could not create site');
    }

    public static function slugify(string $s): string
    {
        if (function_exists('iconv')) {
            $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
            if ($t !== false) {
                $s = $t;
            }
        }
        $s = strtolower((string)preg_replace('/[^a-zA-Z0-9]+/', '-', $s));
        return trim(substr(trim($s, '-'), 0, 40), '-');
    }

    private static function slugTaken(string $slug, int $exceptUid): bool
    {
        return (bool)Db::value('SELECT 1 FROM sites WHERE slug = ? AND user_id <> ?', [$slug, $exceptUid]);
    }

    public static function checkSlug(string $slug, int $uid): ?string
    {
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/', $slug) || str_contains($slug, '--')) {
            return 'Use 3–40 lowercase letters, numbers or single dashes.';
        }
        if (in_array($slug, self::RESERVED, true)) {
            return 'That address is reserved. Try another.';
        }
        if (self::slugTaken($slug, $uid)) {
            return 'That address is already taken.';
        }
        return null;
    }

    public static function defaults(array $user): array
    {
        $title = (string)(($user['business_name'] ?? '') ?: ($user['name'] ?? '') ?: 'My business');
        return [
            'title' => $title,
            'tagline' => 'Welcome! Message us to order.',
            'about' => '',
            'accent' => self::TEMPLATES['shop']['accent'],
            'logo' => '',
            'cover' => '',
            'address' => '',
            'hours' => '',
            'show_phone' => true,
            'items' => [
                ['name' => 'Your first product', 'price' => '$10', 'description' => 'Describe it here. Customers tap the button to message you.', 'image' => '', 'category' => ''],
            ],
            'links' => [],
        ];
    }

    private static function cleanImage(mixed $v): string
    {
        $v = is_string($v) ? $v : '';
        return preg_match('#^media/[a-f0-9]{24}\.(jpg|png|webp|gif)$#', $v) ? $v : '';
    }

    public static function cleanData(mixed $in): array
    {
        $in = is_array($in) ? $in : [];
        $accent = (string)($in['accent'] ?? '');
        $out = [
            'title' => clean_text($in['title'] ?? '', 80),
            'tagline' => clean_text($in['tagline'] ?? '', 140),
            'about' => clean_text($in['about'] ?? '', 1500, true),
            'accent' => preg_match('/^#[0-9a-fA-F]{6}$/', $accent) ? strtolower($accent) : '#4f46e5',
            'logo' => self::cleanImage($in['logo'] ?? ''),
            'cover' => self::cleanImage($in['cover'] ?? ''),
            'address' => clean_text($in['address'] ?? '', 200, true),
            'hours' => clean_text($in['hours'] ?? '', 300, true),
            'show_phone' => !empty($in['show_phone']),
            'items' => [],
            'links' => [],
        ];
        foreach (array_slice(is_array($in['items'] ?? null) ? $in['items'] : [], 0, 100) as $it) {
            if (!is_array($it)) {
                continue;
            }
            $item = [
                'name' => clean_text($it['name'] ?? '', 80),
                'price' => clean_text($it['price'] ?? '', 30),
                'description' => clean_text($it['description'] ?? '', 400, true),
                'image' => self::cleanImage($it['image'] ?? ''),
                'category' => clean_text($it['category'] ?? '', 40),
            ];
            if ($item['name'] !== '') {
                $out['items'][] = $item;
            }
        }
        foreach (array_slice(is_array($in['links'] ?? null) ? $in['links'] : [], 0, 20) as $ln) {
            if (!is_array($ln)) {
                continue;
            }
            $url = clean_text($ln['url'] ?? '', 300);
            if ($url !== '' && !preg_match('#^https?://#i', $url)) {
                $url = 'https://' . $url;
            }
            $label = clean_text($ln['label'] ?? '', 60);
            if ($label !== '' && filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url)) {
                $out['links'][] = ['label' => $label, 'url' => $url];
            }
        }
        if ($out['title'] === '') {
            throw new ApiError('Give your site a title.');
        }
        return $out;
    }

    public static function present(array $site): array
    {
        $data = json_decode((string)$site['data'], true) ?: [];
        $out = [
            'slug' => (string)$site['slug'],
            'url' => self::url((string)$site['slug']),
            'mode' => (string)$site['mode'],
            'template' => (string)$site['template'],
            'published' => (bool)(int)$site['published'],
            'live' => self::isLive($site),
            'data' => $data,
            'custom_files' => (int)$site['custom_files'],
            'custom_at' => (int)$site['custom_at'],
            'updated_at' => (int)$site['updated_at'],
        ];
        if ($site['mode'] === 'custom' && (int)$site['custom_files'] > 0) {
            $out['preview_url'] = self::url((string)$site['slug']) . '?preview=' . self::previewToken((int)$site['user_id'], (string)$site['slug']);
        }
        return $out;
    }

    public static function previewToken(int $uid, string $slug): string
    {
        $exp = time() + 3600;
        return $exp . '.' . substr(hmac("preview|{$uid}|{$slug}|{$exp}"), 0, 32);
    }

    public static function checkPreviewToken(string $token, int $uid, string $slug): bool
    {
        if (!preg_match('/^(\d{10})\.([a-f0-9]{32})$/', $token, $m) || (int)$m[1] < time()) {
            return false;
        }
        return hash_equals(substr(hmac("preview|{$uid}|{$slug}|{$m[1]}"), 0, 32), $m[2]);
    }

    public static function save(int $uid, array $in): array
    {
        $site = self::forUser($uid);
        $slug = strtolower(trim((string)($in['slug'] ?? $site['slug'])));
        if ($slug !== $site['slug'] && ($err = self::checkSlug($slug, $uid))) {
            throw new ApiError($err, 422, ['field' => 'slug']);
        }
        $mode = ($in['mode'] ?? $site['mode']) === 'custom' ? 'custom' : 'template';
        $template = (string)($in['template'] ?? $site['template']);
        if (!isset(self::TEMPLATES[$template])) {
            $template = 'shop';
        }
        $data = array_key_exists('data', $in) ? self::cleanData($in['data']) : (json_decode((string)$site['data'], true) ?: []);
        $published = !empty($in['published']);
        if ($published && $mode === 'custom' && (int)$site['custom_files'] === 0) {
            throw new ApiError('Paste or upload your website code before publishing.', 422);
        }
        try {
            Db::run(
                'UPDATE sites SET slug = ?, mode = ?, template = ?, data = ?, published = ?, updated_at = ? WHERE user_id = ?',
                [$slug, $mode, $template, json_encode($data, JSON_UNESCAPED_UNICODE), $published ? 1 : 0, time(), $uid]
            );
        } catch (Throwable $e) {
            if (Db::isUniqueViolation($e)) {
                throw new ApiError('That address is already taken.', 422, ['field' => 'slug']);
            }
            throw $e;
        }
        self::cleanupMedia($uid, $data);
        return Db::one('SELECT * FROM sites WHERE user_id = ?', [$uid]);
    }

    /** Remove uploaded images that are no longer used (keeps anything newer than a day for open drafts). */
    private static function cleanupMedia(int $uid, array $data): void
    {
        $dir = self::dir($uid, 'media');
        if (!is_dir($dir)) {
            return;
        }
        $used = array_filter(array_merge([$data['logo'] ?? '', $data['cover'] ?? ''], array_column($data['items'] ?? [], 'image')));
        $used = array_flip(array_map('basename', $used));
        foreach (glob($dir . '/*') ?: [] as $f) {
            if (!isset($used[basename($f)]) && filemtime($f) < time() - 86400) {
                @unlink($f);
            }
        }
    }

    public static function uploadImage(int $uid, array $file): array
    {
        $site = self::forUser($uid);
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiError(upload_error_message((int)($file['error'] ?? UPLOAD_ERR_NO_FILE)));
        }
        $max = (int)cfg('limits.image_mb', 4) * 1024 * 1024;
        if ((int)$file['size'] > $max) {
            throw new ApiError('Images can be up to ' . cfg('limits.image_mb', 4) . ' MB.');
        }
        $tmp = (string)$file['tmp_name'];
        $mime = function_exists('finfo_open') ? (string)(new finfo(FILEINFO_MIME_TYPE))->file($tmp) : (string)(getimagesize($tmp)['mime'] ?? '');
        if (!isset(self::IMAGE_TYPES[$mime]) || @getimagesize($tmp) === false) {
            throw new ApiError('Upload a JPG, PNG, WebP or GIF image.');
        }
        $dir = ensure_dir(self::dir($uid, 'media'));
        if (count(glob($dir . '/*') ?: []) >= (int)cfg('limits.media_files', 200)) {
            throw new ApiError('You have too many images. Remove some and save your site first.');
        }
        $name = random_hex(12) . '.' . self::IMAGE_TYPES[$mime];
        if (!move_uploaded_file($tmp, $dir . '/' . $name) && !(PHP_SAPI === 'cli' && rename($tmp, $dir . '/' . $name))) {
            throw new ApiError('Could not save the image.', 500);
        }
        @chmod($dir . '/' . $name, 0644);
        return ['path' => 'media/' . $name, 'url' => self::url((string)$site['slug']) . 'media/' . $name];
    }

    /** Accepts a .zip (with index.html at its root or inside one folder) or a single .html file. */
    public static function uploadCustom(int $uid, array $file): array
    {
        $site = self::forUser($uid);
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiError(upload_error_message((int)($file['error'] ?? UPLOAD_ERR_NO_FILE)));
        }
        $maxUpload = (int)cfg('limits.custom_upload_mb', 10) * 1024 * 1024;
        if ((int)$file['size'] > $maxUpload) {
            throw new ApiError('Uploads can be up to ' . cfg('limits.custom_upload_mb', 10) . ' MB.');
        }
        $name = strtolower((string)($file['name'] ?? ''));
        $tmp = (string)$file['tmp_name'];
        if (preg_match('/\.html?$/', $name)) {
            $html = (string)file_get_contents($tmp);
            return self::installCustom($uid, fn(string $stage) => self::writeIndex($stage, $html), false);
        }
        if (!str_ends_with($name, '.zip')) {
            throw new ApiError('Upload a .zip of your website, or a single .html file.');
        }
        return self::installCustom($uid, fn(string $stage) => self::extractZip($tmp, $stage), false);
    }

    /** Publishes code pasted into the app (typically written by ChatGPT, Claude, Gemini …) as index.html. */
    public static function pasteCustom(int $uid, string $code, bool $publish): array
    {
        self::forUser($uid);
        $html = self::cleanPasted($code);
        return self::installCustom($uid, fn(string $stage) => self::writeIndex($stage, $html), $publish);
    }

    /** Keeps only the code when someone pastes a whole AI reply ("Here is your site: ```html … ``` Enjoy!"). */
    public static function cleanPasted(string $code): string
    {
        if (!preg_match('//u', $code)) {
            throw new ApiError("The code contains characters we can't read. Copy it again from your AI tool.");
        }
        $code = trim(str_replace(["\r\n", "\r"], "\n", $code));
        if (preg_match('/```[A-Za-z]*[ \t]*\n(.*?)\n[ \t]*```/s', $code, $m) && str_contains($m[1], '<')) {
            $code = trim($m[1]);
        }
        if ($code === '') {
            throw new ApiError('Paste your website code first.');
        }
        if (!preg_match('/<\s*[a-z!]/i', $code)) {
            throw new ApiError("That doesn't look like website code. Paste the HTML your AI tool gave you (it usually starts with <!DOCTYPE html>).");
        }
        $maxKb = (int)cfg('limits.paste_kb', 1500);
        if (strlen($code) > $maxKb * 1024) {
            throw new ApiError("That code is too long (max {$maxKb} KB). Upload it as a .zip instead.", 413);
        }
        return $code;
    }

    /** The current index.html, so pasted sites can be edited and re-published. */
    public static function customCode(int $uid): array
    {
        $site = self::forUser($uid);
        $file = self::dir($uid, 'custom') . '/index.html';
        $html = is_file($file) && filesize($file) <= (int)cfg('limits.paste_kb', 1500) * 1024 ? (string)file_get_contents($file) : '';
        return ['html' => $html, 'files' => (int)$site['custom_files']];
    }

    private static function writeIndex(string $stage, string $html): int
    {
        if (file_put_contents($stage . '/index.html', $html) === false) {
            throw new ApiError('Could not save your site.', 500);
        }
        return 1;
    }

    /** Builds the new files in a staging folder, then swaps them in, so a failed upload never breaks the live site. */
    private static function installCustom(int $uid, callable $fill, bool $publish): array
    {
        $root = ensure_dir(self::dir($uid));
        $stage = $root . '/custom_new_' . random_hex(6);
        ensure_dir($stage);
        try {
            $count = (int)$fill($stage);
            $live = $root . '/custom';
            $old = $root . '/custom_old_' . random_hex(6);
            if (is_dir($live) && !rename($live, $old)) {
                throw new ApiError('Could not replace the old files.', 500);
            }
            if (!rename($stage, $live)) {
                is_dir($old) && rename($old, $live);
                throw new ApiError('Could not publish the new files.', 500);
            }
            delete_tree($old);
        } catch (Throwable $e) {
            delete_tree($stage);
            throw $e;
        }
        $now = time();
        Db::run(
            'UPDATE sites SET mode = ?, custom_files = ?, custom_at = ?, updated_at = ?' . ($publish ? ', published = 1' : '') . ' WHERE user_id = ?',
            ['custom', $count, $now, $now, $uid]
        );
        return Db::one('SELECT * FROM sites WHERE user_id = ?', [$uid]);
    }

    private static function extractZip(string $zipPath, string $dest): int
    {
        if (!class_exists('ZipArchive')) {
            throw new ApiError('This server is missing the PHP zip extension. Enable it in cPanel → Select PHP Version → Extensions.', 500);
        }
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new ApiError("That file isn't a valid .zip archive.");
        }
        $maxFiles = (int)cfg('limits.custom_files', 300);
        $maxBytes = (int)cfg('limits.custom_unpacked_mb', 30) * 1024 * 1024;
        $entries = [];
        $total = 0;
        $rejected = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $st = $zip->statIndex($i);
            $path = str_replace('\\', '/', (string)$st['name']);
            if (str_ends_with($path, '/')) {
                continue;  // directory entry
            }
            $parts = explode('/', $path);
            if (in_array('__MACOSX', $parts, true) || basename($path) === '.DS_Store' || basename($path) === 'Thumbs.db') {
                continue;
            }
            foreach ($parts as $p) {
                if ($p === '' || $p === '.' || $p === '..' || str_starts_with($p, '.') || !preg_match('/^[A-Za-z0-9 _.@()+\-]+$/', $p)) {
                    $rejected[] = $path;
                    continue 2;
                }
            }
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (!isset(self::CUSTOM_TYPES[$ext])) {
                $rejected[] = $path;
                continue;
            }
            $total += (int)$st['size'];
            $entries[$i] = $path;
        }
        if ($rejected) {
            $zip->close();
            $show = implode(', ', array_slice($rejected, 0, 5)) . (count($rejected) > 5 ? '…' : '');
            throw new ApiError('These files are not allowed (only HTML, CSS, JS, images, fonts and media; no PHP or hidden files): ' . $show);
        }
        if (!$entries) {
            $zip->close();
            throw new ApiError('The .zip is empty.');
        }
        if (count($entries) > $maxFiles) {
            $zip->close();
            throw new ApiError("Too many files (max {$maxFiles}).");
        }
        if ($total > $maxBytes) {
            $zip->close();
            throw new ApiError('The unpacked website is larger than ' . cfg('limits.custom_unpacked_mb', 30) . ' MB.');
        }

        // If everything sits in one top-level folder (a zipped folder), strip it.
        $prefix = '';
        $firsts = array_unique(array_map(fn($p) => str_contains($p, '/') ? explode('/', $p)[0] . '/' : '', $entries));
        if (count($firsts) === 1 && $firsts[0] !== '' && !in_array('index.html', $entries, true)) {
            $prefix = $firsts[0];
        }
        $hasIndex = false;
        $written = 0;
        foreach ($entries as $i => $path) {
            $rel = $prefix !== '' ? substr($path, strlen($prefix)) : $path;
            if ($rel === 'index.html') {
                $hasIndex = true;
            }
            $target = $dest . '/' . $rel;
            ensure_dir(dirname($target));
            $in = $zip->getStream($zip->getNameIndex($i));
            $out = fopen($target, 'wb');
            if (!$in || !$out) {
                $zip->close();
                throw new ApiError('Could not unpack ' . $rel, 500);
            }
            $bytes = stream_copy_to_stream($in, $out, $maxBytes - $written + 1);
            fclose($in);
            fclose($out);
            $written += (int)$bytes;
            if ($written > $maxBytes) {
                $zip->close();
                throw new ApiError('The unpacked website is too large.');
            }
        }
        $zip->close();
        if (!$hasIndex) {
            throw new ApiError('Your .zip needs an index.html file at the top level.');
        }
        return count($entries);
    }

    public static function removeCustom(int $uid): array
    {
        self::forUser($uid);
        delete_tree(self::dir($uid, 'custom'));
        Db::run("UPDATE sites SET mode = 'template', custom_files = 0, custom_at = 0, updated_at = ? WHERE user_id = ?", [time(), $uid]);
        return Db::one('SELECT * FROM sites WHERE user_id = ?', [$uid]);
    }

    public static function deleteAll(int $uid): void
    {
        delete_tree(self::dir($uid));
        Db::run('DELETE FROM sites WHERE user_id = ?', [$uid]);
    }

    /** Renders a template site to HTML. $baseHref is set for in-editor previews. */
    public static function render(string $template, array $data, array $owner, string $slug, ?string $baseHref = null): string
    {
        if (!isset(self::TEMPLATES[$template])) {
            $template = 'shop';
        }
        $site = $data + self::defaults($owner);
        $meta = self::TEMPLATES[$template];
        $siteBase = self::url($slug);
        $img = fn(string $p) => $p === '' ? '' : $siteBase . $p;
        $h = 'e';
        $phone = !empty($site['show_phone']) ? (string)$owner['phone'] : '';
        $appUrl = base_path();
        ob_start();
        try {
            include APP_DIR . '/templates/layout.php';
        } finally {
            $html = (string)ob_get_clean();
        }
        return $html;
    }

    public static function chatText(string $template, array $item): string
    {
        $cta = self::TEMPLATES[$template]['cta'] ?? "I'm interested in";
        $price = trim((string)($item['price'] ?? ''));
        return "Hi! {$cta}: {$item['name']}" . ($price !== '' ? " ({$price})" : '');
    }
}
