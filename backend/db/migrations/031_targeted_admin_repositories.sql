ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('available', 'filling_fast', 'sold_out', 'hidden', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
