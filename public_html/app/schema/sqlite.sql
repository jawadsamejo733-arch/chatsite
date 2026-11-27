-- ChatSite schema for SQLite (local development and automated tests only).

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL DEFAULT '',
  business_name VARCHAR(80) NOT NULL DEFAULT '',
  about VARCHAR(200) NOT NULL DEFAULT '',
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
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  a_read_id INTEGER NOT NULL DEFAULT 0,
  b_read_id INTEGER NOT NULL DEFAULT 0,
  a_delivered_id INTEGER NOT NULL DEFAULT 0,
  b_delivered_id INTEGER NOT NULL DEFAULT 0,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  receipt_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS idx_conv_b ON conversations (user_b);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages (sender_id, created_at);

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
