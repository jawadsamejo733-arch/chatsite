<?php
declare(strict_types=1);

defined('CHATSITE') || exit;

/** Small PDO wrapper. Works with MySQL/MariaDB (production) and SQLite (local dev & tests). */
final class Db
{
    private static ?PDO $pdo = null;

    public static function connect(string $dsn, string $user = '', string $pass = ''): PDO
    {
        $pdo = new PDO($dsn, $user !== '' ? $user : null, $pass !== '' ? $pass : null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        if (str_starts_with($dsn, 'sqlite:')) {
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } else {
            $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("SET time_zone = '+00:00'");
        }
        return $pdo;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = self::connect((string)cfg('db.dsn'), (string)cfg('db.user'), (string)cfg('db.pass'));
            if (cfg('auto_migrate')) {
                self::migrate(self::$pdo);
            }
        }
        return self::$pdo;
    }

    public static function driver(?PDO $pdo = null): string
    {
        return ($pdo ?? self::pdo())->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $v = self::run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function insert(string $sql, array $params = []): int
    {
        self::run($sql, $params);
        return (int)self::pdo()->lastInsertId();
    }

    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function isUniqueViolation(Throwable $e): bool
    {
        return $e instanceof PDOException && in_array((string)$e->getCode(), ['23000', '23505'], true);
    }

    /** Creates the tables if they do not exist yet. Safe to run repeatedly. */
    public static function migrate(PDO $pdo): void
    {
        $driver = self::driver($pdo);
        $file = APP_DIR . '/schema/' . ($driver === 'sqlite' ? 'sqlite.sql' : 'mysql.sql');
        $sql = (string)file_get_contents($file);
        $sql = (string)preg_replace('/^\s*--.*$/m', '', $sql);
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            $pdo->exec($statement);
        }
    }
}
