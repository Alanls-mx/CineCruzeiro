-- Phase 3A: targeted order persistence and lookup support.
-- Keep the legacy columns and API contract intact for application rollback.

UPDATE orders
SET idempotency_key = NULL
WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) = '';

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders(customer_user_id, created_at DESC)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_session_state
  ON orders(session_id, status, reservation_expires_at)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_type
  ON order_items(order_id, item_type);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amounts_non_negative') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_amounts_non_negative CHECK (
      subtotal >= 0 AND discount_total >= 0 AND total >= 0
      AND service_subtotal >= 0 AND goods_subtotal >= 0
      AND club_credits_applied >= 0 AND club_discount >= 0
      AND additional_payment >= 0
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE orders VALIDATE CONSTRAINT orders_amounts_non_negative;
