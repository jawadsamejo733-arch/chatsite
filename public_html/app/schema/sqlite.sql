-- ChatSite schema (version 2) for SQLite (local development and automated tests only).

CREATE TABLE IF NOT EXISTS meta (
  k VARCHAR(40) NOT NULL PRIMARY KEY,
  v VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL DEFAULT '',
  business_name VARCHAR(80) NOT NULL DEFAULT '',
  about VARCHAR(200) NOT NULL DEFAULT '',
  avatar VARCHAR(40) NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone VARCHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes (phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_ip ON otp_codes (ip, created_at);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(10) NOT NULL DEFAULT 'direct',
  direct_key VARCHAR(50) NULL UNIQUE,
  title VARCHAR(80) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  avatar VARCHAR(40) NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  receipt_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'member',
  read_id INTEGER NOT NULL DEFAULT 0,
  delivered_id INTEGER NOT NULL DEFAULT 0,
  cleared_id INTEGER NOT NULL DEFAULT 0,
  left_id INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  pinned_at INTEGER NOT NULL DEFAULT 0,
  muted_until INTEGER NOT NULL DEFAULT 0,
  typing_at INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members (user_id);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  media_key VARCHAR(40) NOT NULL DEFAULT '',
  media TEXT NOT NULL,
  reply_to INTEGER NOT NULL DEFAULT 0,
  forwarded INTEGER NOT NULL DEFAULT 0,
  edited_at INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages (sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_media ON messages (media_key);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_hidden (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_updates_conv ON message_updates (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_updates_time ON message_updates (created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS sites (
  user_id INTEGER PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  mode VARCHAR(10) NOT NULL DEFAULT 'template',
  template VARCHAR(20) NOT NULL DEFAULT 'shop',
  data TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  custom_files INTEGER NOT NULL DEFAULT 0,
  custom_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
