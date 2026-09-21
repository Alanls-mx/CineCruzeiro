-- Physical counter sales remain paid but unavailable until printing is confirmed.
-- Keep every legacy lifecycle value accepted while adding the print checkpoint.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending',
      'pending_payment',
      'processing',
      'paid_pending_print',
      'paid',
      'expired',
      'cancelled',
      'refunded'
    )
  );
