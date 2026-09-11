const { cinemaIsoDate } = require("../db/postgresStore");
const { timedQuery, runMutation } = require("./repositorySupport");

function sessionStart(session) {
  const date = String(session.date || "").slice(0, 10);
  const time = String(session.time || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
    ? `${date} ${time}:00-03`
    : "";
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    movieId: row.movie_id,
    date: cinemaIsoDate(row.starts_at),
    time: row.time_label,
    format: row.format,
    room: row.room_label || row.room_id || "",
    roomId: row.room_id || "",
    ticketTypeIds: Array.isArray(row.ticket_type_ids) ? row.ticket_type_ids : [],
    priceFull: Number(row.price_full || 0),
    priceHalf: Number(row.price_half || 0),
    status: row.status || "available"
  };
}

async function replaceTicketTypes(client, sessionId, ticketTypeIds = []) {
  await timedQuery(client, "DELETE FROM session_ticket_types WHERE session_id = $1", [sessionId], { repository: "session", operation: "ticket_types.delete" });
  for (const [index, ticketTypeId] of ticketTypeIds.entries()) {
    await timedQuery(client, `INSERT INTO session_ticket_types (session_id, ticket_type_id, position)
      VALUES ($1, $2, $3)`, [sessionId, ticketTypeId, (index + 1) * 10], { repository: "session", operation: "ticket_types.insert" });
  }
}

async function insertSession(client, movieId, session) {
  const result = await timedQuery(client, `INSERT INTO sessions
    (id, movie_id, room_id, starts_at, time_label, room_label, format, price_full, price_half, status, updated_at)
    VALUES ($1, $2, $3, NULLIF($4, '')::timestamptz, $5, $6, $7, $8, $9, $10, now())
    RETURNING *`, [
    session.id,
    movieId,
    session.roomId,
    sessionStart(session),
    session.time,
    session.room || "",
    session.format,
    Number(session.priceFull || 0),
    Number(session.priceHalf || 0),
    session.status || "available"
  ], { repository: "session", operation: "insert" });
  await replaceTicketTypes(client, session.id, session.ticketTypeIds);
  return mapSession({ ...result.rows[0], ticket_type_ids: session.ticketTypeIds });
}

async function findById(id) {
  const result = await timedQuery(null, `SELECT sessions.*,
      COALESCE(array_agg(session_ticket_types.ticket_type_id ORDER BY session_ticket_types.position)
        FILTER (WHERE session_ticket_types.ticket_type_id IS NOT NULL), '{}') AS ticket_type_ids
    FROM sessions
    LEFT JOIN session_ticket_types ON session_ticket_types.session_id = sessions.id
    WHERE sessions.id = $1
    GROUP BY sessions.id`, [id], { repository: "session", operation: "findById" });
  return mapSession(result.rows[0]);
}

async function syncSessionSnapshots(client, movie, session, reason = "") {
  const timestamp = new Date().toISOString();
  const common = {
    movieId: movie.id,
    movieTitle: movie.title || "",
    sessionDate: session.date,
    sessionTime: session.time,
    sessionRoom: session.room,
    sessionFormat: session.format,
    sessionStatus: session.status,
    sessionUpdatedAt: timestamp,
    ...(session.status === "cancelled" ? {
      sessionCancelledAt: timestamp,
      sessionCancellationReason: reason || "Sessão cancelada pelo cinema"
    } : {})
  };
  const orders = await timedQuery(client, `UPDATE orders
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = now()
    WHERE session_id = $1`, [session.id, JSON.stringify(common)], { repository: "session", operation: "orders.sync" });
  const tickets = await timedQuery(client, `UPDATE tickets
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
    WHERE session_id = $1`, [session.id, JSON.stringify(common)], { repository: "session", operation: "tickets.sync" });
  if (session.status === "cancelled") {
    await timedQuery(client, `UPDATE orders
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('refundStatus', COALESCE(metadata->>'refundStatus', 'required')),
          updated_at = now()
      WHERE session_id = $1 AND status = 'paid'`, [session.id], { repository: "session", operation: "orders.refund_flag" });
    await timedQuery(client, `UPDATE payments
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'refundStatus', COALESCE(metadata->>'refundStatus', 'required'),
        'sessionCancellationReason', $2::text
      ), updated_at = now()
      WHERE order_id IN (SELECT id FROM orders WHERE session_id = $1) AND status = 'approved'`, [
      session.id,
      reason || "Sessão cancelada pelo cinema"
    ], { repository: "session", operation: "payments.refund_flag" });
  }
  return { ordersUpdated: orders.rowCount, ticketsUpdated: tickets.rowCount, timestamp };
}

async function create(movieId, session, options = {}) {
  return runMutation({
    event: "repository.session.create",
    metadata: { repository: "session", operation: "create", sessionId: session.id, movieId },
    audit: options.audit
  }, async (client) => {
    const created = await insertSession(client, movieId, session);
    await timedQuery(client, "UPDATE movies SET updated_at = now() WHERE id = $1", [movieId], { repository: "session", operation: "movie.touch" });
    return created;
  });
}

async function createMany(movieId, sessions, options = {}) {
  return runMutation({
    event: "repository.session.create_many",
    metadata: { repository: "session", operation: "create_many", movieId, count: sessions.length },
    audit: options.audit
  }, async (client) => {
    const created = [];
    for (const session of sessions) created.push(await insertSession(client, movieId, session));
    await timedQuery(client, "UPDATE movies SET updated_at = now() WHERE id = $1", [movieId], { repository: "session", operation: "movie.touch" });
    return created;
  });
}

async function update(movie, session, options = {}) {
  return runMutation({
    event: "repository.session.update",
    metadata: { repository: "session", operation: "update", sessionId: session.id, movieId: movie.id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `UPDATE sessions SET
      room_id = $2, starts_at = NULLIF($3, '')::timestamptz, time_label = $4,
      room_label = $5, format = $6, price_full = $7, price_half = $8,
      status = $9, updated_at = now()
      WHERE id = $1 AND movie_id = $10
      RETURNING *`, [
      session.id,
      session.roomId,
      sessionStart(session),
      session.time,
      session.room || "",
      session.format,
      Number(session.priceFull || 0),
      Number(session.priceHalf || 0),
      session.status || "available",
      movie.id
    ], { repository: "session", operation: "update" });
    if (!result.rowCount) return null;
    await replaceTicketTypes(client, session.id, session.ticketTypeIds);
    const synchronized = await syncSessionSnapshots(client, movie, session, options.reason);
    await timedQuery(client, "UPDATE movies SET updated_at = now() WHERE id = $1", [movie.id], { repository: "session", operation: "movie.touch" });
    return { session: mapSession({ ...result.rows[0], ticket_type_ids: session.ticketTypeIds }), synchronized };
  });
}

async function remove(movieId, sessionId, options = {}) {
  return runMutation({
    event: "repository.session.delete",
    metadata: { repository: "session", operation: "delete", sessionId, movieId },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, "DELETE FROM sessions WHERE id = $1 AND movie_id = $2 RETURNING *", [sessionId, movieId], { repository: "session", operation: "delete" });
    await timedQuery(client, "UPDATE movies SET updated_at = now() WHERE id = $1", [movieId], { repository: "session", operation: "movie.touch" });
    return mapSession(result.rows[0]);
  });
}

module.exports = {
  mapSession,
  findById,
  insertSession,
  syncSessionSnapshots,
  create,
  createMany,
  update,
  remove
};
