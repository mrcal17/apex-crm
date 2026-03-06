-- ============================================================
-- USER SESSIONS
-- Track active sessions per user with device/IP info.
-- Users can view and revoke sessions from the settings panel.
-- All access goes through API routes using the service role key.
-- ============================================================

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
