CREATE TABLE IF NOT EXISTS seat_holds (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL,
  owner_token TEXT NOT NULL,
  connection_id TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seat_id)
);

CREATE INDEX IF NOT EXISTS seat_holds_owner_idx ON seat_holds (session_id, owner_token);
CREATE INDEX IF NOT EXISTS seat_holds_expiration_idx ON seat_holds (expires_at);
