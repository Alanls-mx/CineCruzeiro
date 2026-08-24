ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_method_check,
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('pix', 'credit_card', 'cash', 'card_terminal', 'external_pix', 'courtesy', 'club_credit')),
  ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('open_finance', 'mercado_pago', 'box_office', 'admin', 'internal_club'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('owner', 'master', 'manager', 'operator', 'seller', 'customer'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_email TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_requested_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  included_tickets INTEGER NOT NULL DEFAULT 0 CHECK (included_tickets >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly')),
  benefits JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'paused', 'cancelled', 'ended', 'payment_failed')),
  provider TEXT NOT NULL DEFAULT 'manual_admin',
  provider_subscription_id TEXT,
  cycle_start TIMESTAMPTZ,
  cycle_end TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  current_period_key TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  credits_available INTEGER NOT NULL DEFAULT 0 CHECK (credits_available >= 0),
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  assigned_by TEXT REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('pending_payment', 'active', 'paused', 'cancelled', 'ended', 'payment_failed'));

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cycle_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cycle_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS subscription_credits (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  rollover_from_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (used + remaining = total)
);

CREATE TABLE IF NOT EXISTS subscription_usage (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  credit_id TEXT REFERENCES subscription_credits(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  movie_id TEXT REFERENCES movies(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  month_key TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscription_usage
  ADD COLUMN IF NOT EXISTS credit_id TEXT REFERENCES subscription_credits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_credits_subscription_id ON subscription_credits(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_id ON subscription_usage(subscription_id);
