CREATE TABLE IF NOT EXISTS social_studio_automation_campaigns (
  id UUID PRIMARY KEY,
  cinema_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  campaign_type TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  source TEXT NOT NULL DEFAULT 'studio',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','qa','ready','failed')),
  stage TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  formats JSONB NOT NULL DEFAULT '[]',
  request JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  warnings JSONB NOT NULL DEFAULT '[]',
  qa JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  error JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_studio_automation_status
  ON social_studio_automation_campaigns(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_studio_automation_cinema
  ON social_studio_automation_campaigns(cinema_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_studio_automation_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES social_studio_automation_campaigns(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error')),
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_studio_automation_events_campaign
  ON social_studio_automation_events(campaign_id, created_at ASC);
