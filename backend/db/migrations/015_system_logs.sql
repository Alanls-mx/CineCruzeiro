CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL DEFAULT 'system',
  event TEXT NOT NULL,
  message TEXT,
  request_id TEXT,
  actor_user_id TEXT,
  actor_email TEXT,
  method TEXT,
  path TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created_at ON system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_category_created_at ON system_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);
