UPDATE subscriptions
SET provider = 'external_pending',
    provider_subscription_id = NULL,
    updated_at = now()
WHERE provider = 'ebanx';

UPDATE payments
SET provider = 'external_manual',
    updated_at = now()
WHERE provider = 'ebanx';

DELETE FROM webhook_events
WHERE provider = 'ebanx';

DROP TABLE IF EXISTS subscription_payments;

ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS metadata;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('open_finance', 'mercado_pago', 'box_office', 'admin', 'internal_club', 'external_manual', 'manual_external'));

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('manual_admin', 'external_pending', 'open_finance', 'mercado_pago', 'box_office', 'admin', 'internal_club'));
