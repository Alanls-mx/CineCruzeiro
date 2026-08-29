ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS seat_selection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seat_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seat_layout JSONB NOT NULL DEFAULT '{"screenLabel":"TELA","rows":[]}'::jsonb;
