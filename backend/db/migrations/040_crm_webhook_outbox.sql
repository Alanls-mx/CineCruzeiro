CREATE TABLE IF NOT EXISTS crm_webhook_outbox (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'delivered', 'dead', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_http_status INTEGER,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_outbox_pending
  ON crm_webhook_outbox (next_attempt_at, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_crm_webhook_outbox_processing_lease
  ON crm_webhook_outbox (locked_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_crm_webhook_outbox_retention
  ON crm_webhook_outbox (status, updated_at);
