CREATE TABLE IF NOT EXISTS session_ticket_types (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, ticket_type_id)
);

CREATE INDEX IF NOT EXISTS idx_session_ticket_types_ticket_type
  ON session_ticket_types(ticket_type_id);

INSERT INTO session_ticket_types (session_id, ticket_type_id, position)
SELECT sessions.id, ticket_types.id,
  ROW_NUMBER() OVER (PARTITION BY sessions.id ORDER BY ticket_types.name)::INTEGER * 10
FROM sessions
CROSS JOIN ticket_types
WHERE ticket_types.active = true
ON CONFLICT (session_id, ticket_type_id) DO NOTHING;
