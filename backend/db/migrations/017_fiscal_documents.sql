CREATE TABLE IF NOT EXISTS fiscal_documents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'nfse',
  provider TEXT NOT NULL DEFAULT 'focus_nfe',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_tax_id TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  concession_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_number TEXT NOT NULL DEFAULT '',
  verification_code TEXT NOT NULL DEFAULT '',
  provider_status TEXT NOT NULL DEFAULT '',
  municipal_url TEXT NOT NULL DEFAULT '',
  pdf_url TEXT NOT NULL DEFAULT '',
  xml_url TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  auto_issued BOOLEAN NOT NULL DEFAULT false,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_sent_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order_id ON fiscal_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status_created_at ON fiscal_documents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_customer_email ON fiscal_documents(lower(customer_email));
