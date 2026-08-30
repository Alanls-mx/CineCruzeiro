ALTER TABLE subscription_usage
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 1;

ALTER TABLE subscription_usage
  DROP CONSTRAINT IF EXISTS subscription_usage_credits_used_check;

ALTER TABLE subscription_usage
  ADD CONSTRAINT subscription_usage_credits_used_check
  CHECK (credits_used BETWEEN 1 AND 20);
