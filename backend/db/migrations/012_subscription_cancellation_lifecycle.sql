ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('pending_payment', 'active', 'paused', 'ending', 'cancelled', 'ended', 'payment_failed')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS benefits_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_mode TEXT,
  ADD COLUMN IF NOT EXISTS reactivation_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_benefits_until
  ON subscriptions(status, benefits_until);
