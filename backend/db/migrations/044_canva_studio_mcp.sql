CREATE TABLE IF NOT EXISTS canva_studio_mcp_oauth (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  access_token JSONB NOT NULL,
  refresh_token JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
