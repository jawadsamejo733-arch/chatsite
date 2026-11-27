-- ChatSite database schema (version 2) for MySQL 5.7+ / MariaDB 10.3+ (GoDaddy cPanel).
-- The installer runs this for you. To install by hand, import it in cPanel → phpMyAdmin.

CREATE TABLE IF NOT EXISTS meta (
  k VARCHAR(40) NOT NULL PRIMARY KEY,
  v VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL DEFAULT '',
  business_name VARCHAR(80) NOT NULL DEFAULT '',
  about VARCHAR(200) NOT NULL DEFAULT '',
  avatar VARCHAR(40) NOT NULL DEFAULT '',
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

-- A chat: "direct" (two people) or "group".
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(10) NOT NULL DEFAULT 'direct',
  direct_key VARCHAR(50) NULL,
  title VARCHAR(80) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  avatar VARCHAR(40) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NOT NULL,
  last_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at INT UNSIGNED NOT NULL,
  updated_at INT UNSIGNED NOT NULL,
  receipt_at INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_conv_direct (direct_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per person per chat: read receipts, and their own pin/mute/archive settings.
-- cleared_id: messages up to this id are hidden for them (cleared chat / joined later).
-- left_id: 0 while they are in the chat; otherwise the last message they can see.
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'member',
  read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  delivered_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cleared_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  left_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  pinned_at INT UNSIGNED NOT NULL DEFAULT 0,
  muted_until INT UNSIGNED NOT NULL DEFAULT 0,
  typing_at INT UNSIGNED NOT NULL DEFAULT 0,
  joined_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- kind: text | image | video | voice | file | location | system
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  media_key VARCHAR(40) NOT NULL DEFAULT '',
  media TEXT NOT NULL,
  reply_to BIGINT UNSIGNED NOT NULL DEFAULT 0,
  forwarded TINYINT(1) NOT NULL DEFAULT 0,
  edited_at INT UNSIGNED NOT NULL DEFAULT 0,
  deleted_at INT UNSIGNED NOT NULL DEFAULT 0,
  created_at INT UNSIGNED NOT NULL,
  KEY idx_msg_conv (conversation_id, id),
  KEY idx_msg_sender (sender_id, created_at),
  KEY idx_msg_media (media_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Delete for me"
CREATE TABLE IF NOT EXISTS message_hidden (
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Change feed for edits, deletions and reactions, so open apps can update messages they already show.
CREATE TABLE IF NOT EXISTS message_updates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  message_id BIGINT UNSIGNED NOT NULL,
  created_at INT UNSIGNED NOT NULL,
  KEY idx_updates_conv (conversation_id, id),
  KEY idx_updates_time (created_at)
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
