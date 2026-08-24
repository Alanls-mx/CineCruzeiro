ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_method_check,
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('pix', 'credit_card', 'cash', 'card_terminal', 'external_pix', 'courtesy')),
  ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('open_finance', 'mercado_pago', 'box_office', 'admin'));
