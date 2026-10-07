CREATE TABLE IF NOT EXISTS canva_studio_templates (
  id TEXT PRIMARY KEY,
  canva_template_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT false,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canva_studio_campaigns (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  movie_id TEXT,
  movie_title TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('teaser', 'campaign', 'session', 'schedule')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  stage TEXT NOT NULL DEFAULT 'planning',
  error JSONB NOT NULL DEFAULT '{}'::jsonb,
  lease_until TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canva_studio_campaigns_recent
  ON canva_studio_campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS canva_studio_assets (
  account_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  canva_asset_id TEXT,
  upload_job_id TEXT,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, content_hash)
);

CREATE TABLE IF NOT EXISTS canva_studio_oauth (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  account_id TEXT NOT NULL DEFAULT '',
  access_token JSONB NOT NULL,
  refresh_token JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canva_studio_oauth_flows (
  state_hash TEXT PRIMARY KEY,
  verifier JSONB NOT NULL,
  admin_user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
