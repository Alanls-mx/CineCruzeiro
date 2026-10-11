CREATE TABLE IF NOT EXISTS ticket_email_jobs (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'delivered', 'dead', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  lease_token TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_due
  ON ticket_email_jobs (next_attempt_at, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_ticket_email_jobs_lease
  ON ticket_email_jobs (locked_at) WHERE status = 'processing';

CREATE OR REPLACE FUNCTION queue_paid_ticket_email() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'paid' AND NEW.metadata->>'ticketEmailRequested' = 'true' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO ticket_email_jobs (order_id) VALUES (NEW.id)
      ON CONFLICT (order_id) DO NOTHING;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO ticket_email_jobs (order_id) VALUES (NEW.id)
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_queue_paid_ticket_email
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION queue_paid_ticket_email();
