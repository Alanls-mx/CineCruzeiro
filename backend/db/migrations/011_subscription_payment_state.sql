ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS external_billing_pending BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS last_authorized_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS last_provider_payment_id TEXT;

UPDATE subscriptions
SET payment_status = CASE
  WHEN status = 'active' THEN 'approved'
  WHEN status IN ('cancelled', 'ended') THEN 'cancelled'
  WHEN status = 'payment_failed' THEN 'failed'
  ELSE COALESCE(NULLIF(payment_status, ''), 'pending')
END;
