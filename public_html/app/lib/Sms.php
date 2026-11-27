<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/**
 * Sends the login code by SMS.
 *  - "log":    writes the message to storage/logs/sms.log (development only).
 *  - "twilio": Twilio Programmable Messaging.
 *  - "http":   any SMS gateway with an HTTP API (configure url/params in config.php).
 */
final class Sms
{
    public static function send(string $phone, string $message): void
    {
        $driver = (string)cfg('sms.driver', 'log');
        match ($driver) {
            'log' => log_line('sms.log', $phone . ' ' . $message),
            'twilio' => self::twilio($phone, $message),
            'http' => self::http($phone, $message),
            default => throw new RuntimeException('Unknown SMS driver: ' . $driver),
        };
    }

    private static function twilio(string $phone, string $message): void
    {
        $sid = (string)cfg('sms.twilio.sid');
        $token = (string)cfg('sms.twilio.token');
        if ($sid === '' || $token === '') {
            throw new RuntimeException('Twilio is not configured (sms.twilio.sid / token).');
        }
        $fields = ['To' => $phone, 'Body' => $message];
        $service = (string)cfg('sms.twilio.messaging_service_sid');
        if ($service !== '') {
            $fields['MessagingServiceSid'] = $service;
        } else {
            $fields['From'] = (string)cfg('sms.twilio.from');
        }

        $url = 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($sid) . '/Messages.json';
        [$status, $body] = self::request('POST', $url, http_build_query($fields), [
            'Content-Type: application/x-www-form-urlencoded',
            'Authorization: Basic ' . base64_encode($sid . ':' . $token),
        ]);
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('Twilio returned HTTP ' . $status . ': ' . substr($body, 0, 300));
        }
    }

    private static function http(string $phone, string $message): void
    {
        $url = (string)cfg('sms.http.url');
        if ($url === '') {
            throw new RuntimeException('HTTP SMS gateway is not configured (sms.http.url).');
        }
        $replace = ['{phone}' => $phone, '{phone_digits}' => ltrim($phone, '+'), '{message}' => $message];
        $params = [];
        foreach ((array)cfg('sms.http.params', []) as $k => $v) {
            $params[$k] = strtr((string)$v, $replace);
        }
        $headers = [];
        foreach ((array)cfg('sms.http.headers', []) as $k => $v) {
            $headers[] = $k . ': ' . $v;
        }
        $method = strtoupper((string)cfg('sms.http.method', 'POST'));
        if ($method === 'GET') {
            $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($params);
            $body = null;
        } elseif (cfg('sms.http.json')) {
            $body = json_encode($params, JSON_UNESCAPED_UNICODE);
            $headers[] = 'Content-Type: application/json';
        } else {
            $body = http_build_query($params);
            $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        }
        [$status, $resp] = self::request($method, $url, $body, $headers);
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('SMS gateway returned HTTP ' . $status . ': ' . substr($resp, 0, 300));
        }
    }

    /** @return array{0:int,1:string} */
    private static function request(string $method, string $url, ?string $body, array $headers): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('The PHP curl extension is required to send SMS.');
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $resp = curl_exec($ch);
        if ($resp === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('SMS request failed: ' . $err);
        }
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return [$status, (string)$resp];
    }
}
