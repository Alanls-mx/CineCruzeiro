-- Close fiscal preparations that can no longer reach their trigger.
-- Authorized/provider-issued documents are intentionally untouched.

WITH terminal_documents AS (
  UPDATE goods_fiscal_documents AS document
  SET status = 'cancelled',
      cancelled_at = COALESCE(document.cancelled_at, now()),
      updated_at = now(),
      metadata = COALESCE(document.metadata, '{}'::jsonb)
        || jsonb_build_object('cancellationReason', 'terminal_order_reconciliation')
  FROM orders AS order_record
  WHERE document.order_id = order_record.id
    AND document.status = 'waiting_trigger'
    AND order_record.status IN ('cancelled', 'expired', 'refunded')
  RETURNING document.order_id
)
UPDATE orders AS order_record
SET goods_fiscal_status = 'cancelled',
    metadata = jsonb_set(
      COALESCE(order_record.metadata, '{}'::jsonb),
      '{goodsFiscalStatus}',
      '"cancelled"'::jsonb,
      true
    ),
    updated_at = now()
WHERE order_record.id IN (SELECT order_id FROM terminal_documents)
  AND order_record.goods_fiscal_status = 'waiting_trigger';
