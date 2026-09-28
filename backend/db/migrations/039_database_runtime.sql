CREATE OR REPLACE FUNCTION notify_cinema_data_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('cine_data_changed', 'changed');
  RETURN NULL;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'settings','users','rooms','ticket_types','movies','sessions','session_ticket_types',
    'concessions','concession_inventory','promotions','ads','orders','order_items',
    'payments','tickets','webhook_events','subscription_plans','subscriptions',
    'subscription_credits','subscription_usage','subscription_cycles','subscription_payments',
    'subscription_credit_units','subscription_credit_redemptions','subscription_accounting_rule_versions',
    'order_service_items','order_goods_items','goods_fiscal_documents'
  ] LOOP
    EXECUTE format('CREATE TRIGGER cinema_cache_invalidation AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION notify_cinema_data_changed()', table_name);
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_email_recipients_processing_lease
  ON email_campaign_recipients (locked_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_email_attempts_started_recipient
  ON email_delivery_attempts (campaign_recipient_id) WHERE status = 'started';
CREATE INDEX IF NOT EXISTS idx_order_items_owner ON order_items (order_id);
