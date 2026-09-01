-- Hybrid Club domain and provider-neutral goods fiscal preparation.
-- Existing aggregate credit tables remain available for backwards compatibility.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS credit_reference_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS credit_validity_days INTEGER,
  ADD COLUMN IF NOT EXISTS allow_credit_rollover BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_accumulated_credits INTEGER,
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_price_difference BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS excluded_concession_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS eligible_formats JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS eligible_session_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cancellation_rules JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accounting_config JSONB NOT NULL DEFAULT '{}';

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS subscription_cycles (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_payment', 'active', 'ended', 'cancelled', 'chargeback')),
  source_payment_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  plan_snapshot JSONB NOT NULL DEFAULT '{}',
  accounting_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  cycle_id TEXT REFERENCES subscription_cycles(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'failed', 'cancelled', 'refunded', 'chargeback')),
  idempotency_key TEXT NOT NULL UNIQUE,
  approved_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS subscription_credit_units (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cycle_id TEXT NOT NULL REFERENCES subscription_cycles(id) ON DELETE RESTRICT,
  reference_value NUMERIC(10,2) NOT NULL CHECK (reference_value >= 0),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'redeemed', 'expired', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  reserved_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  rollover_from_id TEXT REFERENCES subscription_credit_units(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_credit_redemptions (
  id TEXT PRIMARY KEY,
  subscription_credit_id TEXT NOT NULL REFERENCES subscription_credit_units(id) ON DELETE RESTRICT,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'redeemed', 'released', 'cancelled', 'refunded')),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  credit_amount NUMERIC(10,2) NOT NULL CHECK (credit_amount >= 0),
  additional_payment_amount NUMERIC(10,2) NOT NULL CHECK (additional_payment_amount >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  reserved_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_accounting_rule_versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  rule_version TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  ticket_component_value NUMERIC(10,2),
  benefits_component_value NUMERIC(10,2),
  configuration JSONB NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, rule_version)
);

CREATE TABLE IF NOT EXISTS order_service_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  subscription_credit_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subscription_credit_amount >= 0),
  additional_payment_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (additional_payment_amount >= 0),
  payment_source TEXT NOT NULL DEFAULT 'standard'
    CHECK (payment_source IN ('standard', 'subscription_credit', 'courtesy', 'promotional')),
  subscription_credit_id TEXT REFERENCES subscription_credit_units(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_goods_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  concession_id TEXT REFERENCES concessions(id) ON DELETE SET NULL,
  sku TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  original_unit_price NUMERIC(10,2) NOT NULL CHECK (original_unit_price >= 0),
  club_discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (club_discount >= 0),
  final_unit_price NUMERIC(10,2) NOT NULL CHECK (final_unit_price >= 0),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_fiscal_documents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (status IN ('not_required', 'waiting_trigger', 'pending', 'authorized', 'contingency', 'cancelled', 'error')),
  trigger TEXT NOT NULL DEFAULT 'goods_delivered'
    CHECK (trigger IN ('payment_approved', 'goods_delivered')),
  provider TEXT,
  provider_document_id TEXT,
  document_number TEXT,
  series TEXT,
  access_key TEXT,
  protocol TEXT,
  xml_reference TEXT,
  danfe_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goods_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS club_credits_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS club_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_payment NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fiscal_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS goods_fiscal_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS goods_fiscal_trigger TEXT NOT NULL DEFAULT 'goods_delivered';

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ticket_number BIGINT GENERATED BY DEFAULT AS IDENTITY,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_credit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_payment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS subscription_credit_id TEXT REFERENCES subscription_credit_units(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_subscription ON subscription_cycles(subscription_id, cycle_start DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_credit_units_available ON subscription_credit_units(subscription_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_credit_redemptions_order ON subscription_credit_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_service_items_order ON order_service_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_goods_items_order ON order_goods_items(order_id);
CREATE INDEX IF NOT EXISTS idx_goods_fiscal_documents_order ON goods_fiscal_documents(order_id);
