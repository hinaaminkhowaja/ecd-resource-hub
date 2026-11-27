CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','REGION','LOCAL_BOARD','REC')),
  region TEXT,
  local_board TEXT,
  rec_code TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS red_flag_reasons (
  id TEXT PRIMARY KEY,
  reason_key TEXT NOT NULL,
  view_type TEXT NOT NULL,
  rec_code TEXT NOT NULL,
  rec_name TEXT,
  region TEXT,
  local_board TEXT,
  class_name TEXT,
  reason TEXT NOT NULL,
  contributor_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(reason_key, view_type, rec_code)
);
CREATE INDEX IF NOT EXISTS red_flags_region_idx ON red_flag_reasons(region, local_board, rec_code);
