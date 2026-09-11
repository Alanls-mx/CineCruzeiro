const { timedQuery, runMutation } = require("./repositorySupport");

function mapRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    capacity: Number(row.capacity || 0),
    technology: row.technology || "",
    status: row.status || "active",
    seatSelectionEnabled: Boolean(row.seat_selection_enabled),
    seatTypes: Array.isArray(row.seat_types) ? row.seat_types : [],
    seatLayout: row.seat_layout && typeof row.seat_layout === "object"
      ? row.seat_layout
      : { screenLabel: "TELA", rows: [] }
  };
}

function params(room) {
  return [
    room.id, room.name, Number(room.capacity || 1), room.technology || "",
    room.status || "active", Boolean(room.seatSelectionEnabled),
    JSON.stringify(room.seatTypes || []),
    JSON.stringify(room.seatLayout || { screenLabel: "TELA", rows: [] })
  ];
}

async function findById(id) {
  const result = await timedQuery(null, "SELECT * FROM rooms WHERE id = $1", [id], { repository: "room", operation: "findById" });
  return mapRoom(result.rows[0]);
}

async function upsertRoom(client, room) {
  const result = await timedQuery(client, `INSERT INTO rooms
    (id, name, capacity, technology, status, seat_selection_enabled, seat_types, seat_layout, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,now())
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, capacity=EXCLUDED.capacity,
      technology=EXCLUDED.technology, status=EXCLUDED.status,
      seat_selection_enabled=EXCLUDED.seat_selection_enabled, seat_types=EXCLUDED.seat_types,
      seat_layout=EXCLUDED.seat_layout, updated_at=now()
    RETURNING *`, params(room), { repository: "room", operation: "upsert" });
  return mapRoom(result.rows[0]);
}

async function create(room, options = {}) {
  return runMutation({
    event: "repository.room.create",
    metadata: { repository: "room", operation: "create", roomId: room.id },
    audit: options.audit
  }, (client) => upsertRoom(client, room));
}

async function update(room, options = {}) {
  return runMutation({
    event: "repository.room.update",
    metadata: { repository: "room", operation: "update", roomId: room.id },
    audit: options.audit
  }, async (client) => {
    const saved = await upsertRoom(client, room);
    const roomLabel = options.roomLabel || room.name;
    const linkedIds = Array.isArray(options.sessionIds) ? options.sessionIds : [];
    const sessions = await timedQuery(client, `UPDATE sessions SET room_id = $1, room_label = $2, updated_at = now()
      WHERE (room_id = $1 OR id = ANY($3::text[]))
        AND (room_id IS DISTINCT FROM $1 OR room_label IS DISTINCT FROM $2)
      RETURNING id`, [room.id, roomLabel, linkedIds], { repository: "room", operation: "sessions.sync" });
    const sessionIds = sessions.rows.map((row) => row.id);
    if (sessionIds.length) {
      const snapshot = JSON.stringify({ sessionRoom: roomLabel, sessionUpdatedAt: new Date().toISOString() });
      await timedQuery(client, `UPDATE orders SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now()
        WHERE session_id = ANY($1::text[])`, [sessionIds, snapshot], { repository: "room", operation: "orders.sync" });
      await timedQuery(client, `UPDATE tickets SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE session_id = ANY($1::text[])`, [sessionIds, snapshot], { repository: "room", operation: "tickets.sync" });
    }
    return { room: saved, sessionIds };
  });
}

async function remove(id, options = {}) {
  return runMutation({
    event: "repository.room.delete",
    metadata: { repository: "room", operation: "delete", roomId: id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, "DELETE FROM rooms WHERE id = $1 RETURNING *", [id], { repository: "room", operation: "delete" });
    return mapRoom(result.rows[0]);
  });
}

module.exports = { mapRoom, findById, create, update, remove };
