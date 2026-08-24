ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS provider_plan_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mercado_pago_plan_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_subscription_plans_display_order
  ON subscription_plans(display_order, name);
