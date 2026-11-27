-- ChatSite database schema for MySQL 5.7+ / MariaDB 10.3+ (GoDaddy cPanel).
-- The installer runs this for you. To install by hand, import it in cPanel → phpMyAdmin.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL DEFAULT '',
  business_name VARCHAR(80) NOT NULL DEFAULT '',
  about VARCHAR(200) NOT NULL DEFAULT '',
  created_at INT UNSIGNED NOT NULL,
  last_seen_at INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at INT UNSIGNED NOT NULL,
  expires_at INT UNSIGNED NOT NULL,
  KEY idx_otp_phone (phone, created_at),
  KEY idx_otp_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_a BIGINT UNSIGNED NOT NULL,
  user_b BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  a_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  b_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  a_delivered_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  b_delivered_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at INT UNSIGNED NOT NULL,
  updated_at INT UNSIGNED NOT NULL,
  receipt_at INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_conv_pair (user_a, user_b),
  KEY idx_conv_b (user_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at INT UNSIGNED NOT NULL,
  KEY idx_msg_conv (conversation_id, id),
  KEY idx_msg_sender (sender_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  slug VARCHAR(40) NOT NULL,
  mode VARCHAR(10) NOT NULL DEFAULT 'template',
  template VARCHAR(20) NOT NULL DEFAULT 'shop',
  data MEDIUMTEXT NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  custom_files INT UNSIGNED NOT NULL DEFAULT 0,
  custom_at INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_sites_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
