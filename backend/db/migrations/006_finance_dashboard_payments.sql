ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('open_finance', 'mercado_pago', 'box_office', 'admin', 'internal_club', 'external_manual', 'manual_external'));
