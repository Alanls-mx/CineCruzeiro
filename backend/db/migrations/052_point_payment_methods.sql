ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('pix', 'credit_card', 'cash', 'card_terminal', 'point_debit', 'point_credit', 'point_qr', 'external_pix', 'courtesy', 'club_credit'));
