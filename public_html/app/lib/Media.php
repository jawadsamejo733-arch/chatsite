<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/**
 * Chat attachments (photos, videos, voice messages, documents) and profile/group photos.
 * Files live in storage/ (never served directly) and are streamed by media.php after an access check.
 */
final class Media
{
    private const IMAGE = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    private const VIDEO = ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov', 'video/3gpp' => '3gp'];
    private const AUDIO = [
        'audio/webm' => 'webm', 'audio/ogg' => 'ogg', 'application/ogg' => 'ogg', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a',
        'audio/mpeg' => 'mp3', 'audio/aac' => 'aac', 'audio/x-hx-aac-adts' => 'aac', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav',
        // Browsers record audio into containers that file sniffing reports as video:
        'video/webm' => 'webm', 'video/mp4' => 'm4a',
    ];
    private const VOICE_MIME = ['webm' => 'audio/webm', 'ogg' => 'audio/ogg', 'm4a' => 'audio/mp4', 'mp3' => 'audio/mpeg', 'aac' => 'audio/aac', 'wav' => 'audio/wav'];

    public static function path(string $key, string $ext, bool $thumb = false): string
    {
        return storage_path('media/' . substr($key, 0, 2) . '/' . $key . ($thumb ? '_t.jpg' : '.' . $ext));
    }

    public static function url(string $key, bool $thumb = false): string
    {
        return 'media.php?k=' . $key . ($thumb ? '&t=1' : '');
    }

    private static function checkUpload(array $file, int $maxMb): string
    {
        $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err !== UPLOAD_ERR_OK) {
            throw new ApiError(upload_error_message($err));
        }
        if ((int)$file['size'] <= 0) {
            throw new ApiError('That file is empty.');
        }
        if ((int)$file['size'] > $maxMb * 1024 * 1024) {
            throw new ApiError("Files can be up to {$maxMb} MB.", 413);
        }
        return (string)$file['tmp_name'];
    }

    private static function sniff(string $tmp): string
    {
        return class_exists('finfo') ? (string)(new finfo(FILEINFO_MIME_TYPE))->file($tmp) : 'application/octet-stream';
    }

    private static function move(string $tmp, string $dest): void
    {
        ensure_dir(dirname($dest));
        if (!move_uploaded_file($tmp, $dest) && !(PHP_SAPI === 'cli' && rename($tmp, $dest))) {
            throw new ApiError('Could not save the file.', 500);
        }
        @chmod($dest, 0644);
    }

    /**
     * Stores an upload for a chat message.
     * @param string $want image|video|voice|file  (what the person picked; the file's real type decides)
     * @return array{kind:string,key:string,media:array}
     */
    public static function storeAttachment(array $file, string $want, float $duration = 0): array
    {
        $limits = (array)cfg('limits');
        $tmp = self::checkUpload($file, (int)($limits['file_mb'] ?? 15));
        $mime = self::sniff($tmp);
        $key = random_hex(12);
        $name = self::cleanName((string)($file['name'] ?? 'file'));
        $size = (int)$file['size'];

        if ($want === 'voice') {
            if (!isset(self::AUDIO[$mime])) {
                throw new ApiError('That recording could not be read. Please try again.');
            }
            $ext = self::AUDIO[$mime];
            self::move($tmp, self::path($key, $ext));
            return ['kind' => 'voice', 'key' => $key, 'media' => [
                'ext' => $ext, 'mime' => self::VOICE_MIME[$ext] ?? 'audio/webm', 'size' => $size,
                'dur' => round(max(0, min(3600, $duration)), 1),
            ]];
        }

        if (isset(self::IMAGE[$mime]) && $want !== 'file') {
            if ($size > (int)($limits['photo_mb'] ?? 10) * 1024 * 1024) {
                throw new ApiError('Photos can be up to ' . ($limits['photo_mb'] ?? 10) . ' MB.', 413);
            }
            $info = @getimagesize($tmp);
            if ($info === false) {
                throw new ApiError("That photo couldn't be read.");
            }
            $ext = self::IMAGE[$mime];
            $dest = self::path($key, $ext);
            ensure_dir(dirname($dest));
            [$w, $h] = [(int)$info[0], (int)$info[1]];
            if ($mime === 'image/jpeg' && ($dims = self::reencodeJpeg($tmp, $dest, 2048))) {
                [$w, $h] = $dims;      // re-encoded: phone-camera GPS/EXIF data removed, size reduced
                $size = (int)filesize($dest);
                @unlink($tmp);
            } else {
                self::move($tmp, $dest);
            }
            $thumb = self::thumbnail($dest, self::path($key, $ext, true), 640);
            return ['kind' => 'image', 'key' => $key, 'media' => [
                'ext' => $ext, 'mime' => $mime, 'size' => $size, 'w' => $w, 'h' => $h, 'thumb' => $thumb,
            ]];
        }

        if (isset(self::VIDEO[$mime]) && $want !== 'file') {
            $ext = self::VIDEO[$mime];
            self::move($tmp, self::path($key, $ext));
            return ['kind' => 'video', 'key' => $key, 'media' => ['ext' => $ext, 'mime' => $mime, 'size' => $size, 'name' => $name]];
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $ext = preg_match('/^[a-z0-9]{1,8}$/', $ext) ? $ext : 'bin';
        self::move($tmp, self::path($key, 'dat'));
        return ['kind' => 'file', 'key' => $key, 'media' => ['ext' => 'dat', 'mime' => $mime, 'size' => $size, 'name' => $name, 'type' => $ext]];
    }

    private static function cleanName(string $name): string
    {
        $name = clean_text(basename(str_replace('\\', '/', $name)), 120);
        $name = (string)preg_replace('/[\x00-\x1F\/\\\\:*?"<>|]+/u', '_', $name);
        return $name !== '' ? $name : 'file';
    }

    /** Profile and group photos: cropped to a square JPEG. Returns the new key. */
    public static function storeAvatar(array $file): string
    {
        $tmp = self::checkUpload($file, (int)cfg('limits.photo_mb', 10));
        $mime = self::sniff($tmp);
        if (!isset(self::IMAGE[$mime]) || @getimagesize($tmp) === false) {
            throw new ApiError('Choose a JPG, PNG, WebP or GIF photo.');
        }
        $key = random_hex(12);
        $dest = storage_path('avatars/' . $key . '.jpg');
        ensure_dir(dirname($dest));
        $img = self::load($tmp, $mime);
        if ($img === null) {
            throw new ApiError('This server cannot process photos (the PHP GD extension is missing).', 500);
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $side = min($w, $h);
        $out = imagecreatetruecolor(320, 320);
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        imagecopyresampled($out, $img, 0, 0, intdiv($w - $side, 2), intdiv($h - $side, 2), 320, 320, $side, $side);
        imagejpeg($out, $dest, 85);
        @unlink($tmp);
        return $key;
    }

    public static function deleteAvatar(string $key): void
    {
        if (preg_match('/^[a-f0-9]{24}$/', $key)) {
            @unlink(storage_path('avatars/' . $key . '.jpg'));
        }
    }

    public static function avatarUrl(string $key): string
    {
        return $key === '' ? '' : 'media.php?a=' . $key;
    }

    /** Loads an image with GD, applying the camera's EXIF rotation. Returns null if GD is unavailable. */
    private static function load(string $file, string $mime): ?GdImage
    {
        if (!function_exists('imagecreatefromjpeg')) {
            return null;
        }
        $info = @getimagesize($file);
        if (!$info || $info[0] * $info[1] > 50_000_000) {
            return null;  // refuse giant images that would exhaust memory
        }
        $img = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($file),
            'image/png' => @imagecreatefrompng($file),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file) : false,
            'image/gif' => @imagecreatefromgif($file),
            default => false,
        };
        if (!$img) {
            return null;
        }
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($file);
            $rotate = [3 => 180, 6 => -90, 8 => 90][(int)($exif['Orientation'] ?? 1)] ?? 0;
            if ($rotate !== 0 && ($r = imagerotate($img, $rotate, 0))) {
                $img = $r;
            }
        }
        return $img;
    }

    /** @return array{0:int,1:int}|null */
    private static function reencodeJpeg(string $src, string $dest, int $max): ?array
    {
        $img = self::load($src, 'image/jpeg');
        if ($img === null) {
            return null;
        }
        [$w, $h] = [imagesx($img), imagesy($img)];
        $scale = min(1, $max / max($w, $h));
        [$nw, $nh] = [max(1, (int)round($w * $scale)), max(1, (int)round($h * $scale))];
        if ($scale < 1) {
            $out = imagecreatetruecolor($nw, $nh);
            imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
            $img = $out;
        }
        return imagejpeg($img, $dest, 84) ? [$nw, $nh] : null;
    }

    private static function thumbnail(string $src, string $dest, int $max): bool
    {
        $mime = self::sniff($src);
        if ($mime === 'image/gif') {
            return false;  // keep GIFs animated: show the original
        }
        $img = self::load($src, $mime);
        if ($img === null) {
            return false;
        }
        [$w, $h] = [imagesx($img), imagesy($img)];
        if (max($w, $h) <= $max && filesize($src) < 250_000) {
            return false;  // small enough already
        }
        $scale = min(1, $max / max($w, $h));
        [$nw, $nh] = [max(1, (int)round($w * $scale)), max(1, (int)round($h * $scale))];
        $out = imagecreatetruecolor($nw, $nh);
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        return imagejpeg($out, $dest, 78);
    }

    public static function present(string $key, string $json): ?array
    {
        if ($key === '' || $json === '') {
            return null;
        }
        $m = json_decode($json, true);
        if (!is_array($m)) {
            return null;
        }
        $out = ['url' => self::url($key), 'mime' => (string)($m['mime'] ?? ''), 'size' => (int)($m['size'] ?? 0)];
        foreach (['w', 'h', 'dur', 'name', 'type'] as $k) {
            if (isset($m[$k])) {
                $out[$k] = $m[$k];
            }
        }
        $out['thumb'] = !empty($m['thumb']) ? self::url($key, true) : $out['url'];
        return $out;
    }

    /** Streams a file with optional HTTP Range support (Safari needs it to play audio and video). */
    public static function stream(string $file, string $type, string $disposition, string $filename = ''): never
    {
        $size = (int)filesize($file);
        header('Content-Type: ' . $type);
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
        header('Cache-Control: private, max-age=31536000, immutable');
        header('Accept-Ranges: bytes');
        $fallback = preg_replace('/[^A-Za-z0-9._ -]+/', '_', $filename) ?: 'file';
        header('Content-Disposition: ' . $disposition . ($filename !== '' ? '; filename="' . $fallback . '"; filename*=UTF-8\'\'' . rawurlencode($filename) : ''));

        $start = 0;
        $end = $size - 1;
        if (isset($_SERVER['HTTP_RANGE']) && preg_match('/^bytes=(\d*)-(\d*)$/', trim((string)$_SERVER['HTTP_RANGE']), $m) && ($m[1] !== '' || $m[2] !== '')) {
            if ($m[1] === '') {
                $start = max(0, $size - (int)$m[2]);
            } else {
                $start = (int)$m[1];
                $end = $m[2] !== '' ? min((int)$m[2], $size - 1) : $size - 1;
            }
            if ($start > $end || $start >= $size) {
                http_response_code(416);
                header('Content-Range: bytes */' . $size);
                exit;
            }
            http_response_code(206);
            header("Content-Range: bytes {$start}-{$end}/{$size}");
        }
        $length = $end - $start + 1;
        header('Content-Length: ' . $length);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
            exit;
        }
        $fh = fopen($file, 'rb');
        fseek($fh, $start);
        while ($length > 0 && !feof($fh)) {
            $chunk = fread($fh, (int)min(65536, $length));
            if ($chunk === false) {
                break;
            }
            echo $chunk;
            $length -= strlen($chunk);
            flush();
        }
        fclose($fh);
        exit;
    }
}
