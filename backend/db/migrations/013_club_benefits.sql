ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS ticket_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concession_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_concession_items JSONB NOT NULL DEFAULT '[]';

ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_ticket_discount_percent_check,
  DROP CONSTRAINT IF EXISTS subscription_plans_concession_discount_percent_check;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_ticket_discount_percent_check
    CHECK (ticket_discount_percent >= 0 AND ticket_discount_percent <= 90),
  ADD CONSTRAINT subscription_plans_concession_discount_percent_check
    CHECK (concession_discount_percent >= 0 AND concession_discount_percent <= 90);

ALTER TABLE subscription_usage
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
