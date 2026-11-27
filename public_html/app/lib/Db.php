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
            // Upgrade the database once after new code is uploaded; a small marker file avoids checking on every request.
            $marker = storage_path('schema-v' . self::SCHEMA_VERSION);
            if (cfg('auto_migrate') || !is_file($marker)) {
                self::migrate(self::$pdo);
                @touch($marker);
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

    private static int $depth = 0;

    /** Runs $fn in a transaction. Nested calls join the outer transaction. */
    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        if (self::$depth > 0) {
            self::$depth++;
            try {
                return $fn();
            } finally {
                self::$depth--;
            }
        }
        $pdo->beginTransaction();
        self::$depth = 1;
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        } finally {
            self::$depth = 0;
        }
    }

    public static function isUniqueViolation(Throwable $e): bool
    {
        return $e instanceof PDOException && in_array((string)$e->getCode(), ['23000', '23505'], true);
    }

    public const SCHEMA_VERSION = 2;

    /**
     * Creates the tables on a fresh database, or upgrades an older one step by step.
     * Safe to run repeatedly. Future versions add "if ($version < N) { ... }" steps below.
     */
    public static function migrate(PDO $pdo): void
    {
        if (!self::hasTable($pdo, 'users')) {
            $driver = self::driver($pdo);
            $file = APP_DIR . '/schema/' . ($driver === 'sqlite' ? 'sqlite.sql' : 'mysql.sql');
            $sql = (string)file_get_contents($file);
            $sql = (string)preg_replace('/^\s*--.*$/m', '', $sql);
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
                $pdo->exec($statement);
            }
            self::setVersion($pdo, self::SCHEMA_VERSION);
            return;
        }
        $version = self::hasTable($pdo, 'meta')
            ? (int)($pdo->query("SELECT v FROM meta WHERE k = 'schema_version'")->fetchColumn() ?: 1)
            : 1;
        if ($version < 2) {
            throw new RuntimeException('This database was created by a pre-release test version of ChatSite. '
                . 'Create a new, empty database and run install.php again.');
        }
    }

    private static function hasTable(PDO $pdo, string $table): bool
    {
        try {
            $pdo->query('SELECT 1 FROM ' . $table . ' LIMIT 1');
            return true;
        } catch (PDOException) {
            return false;
        }
    }

    private static function setVersion(PDO $pdo, int $version): void
    {
        $pdo->prepare("DELETE FROM meta WHERE k = 'schema_version'")->execute();
        $pdo->prepare("INSERT INTO meta (k, v) VALUES ('schema_version', ?)")->execute([(string)$version]);
    }
}
