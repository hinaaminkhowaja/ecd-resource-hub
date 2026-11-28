CREATE TABLE IF NOT EXISTS login_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  login_at TEXT NOT NULL,
  logout_at TEXT,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_activity_user_time ON login_activity(user_id, login_at);
CREATE INDEX IF NOT EXISTS idx_login_activity_login_time ON login_activity(login_at);