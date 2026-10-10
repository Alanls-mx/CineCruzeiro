ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS cleanup_minutes integer NOT NULL DEFAULT 20
  CHECK (cleanup_minutes BETWEEN 0 AND 120);
