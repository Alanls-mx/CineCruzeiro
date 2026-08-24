ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_unsubscribe_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unsubscribe_token
  ON users (email_unsubscribe_token)
  WHERE email_unsubscribe_token IS NOT NULL AND email_unsubscribe_token <> '';
