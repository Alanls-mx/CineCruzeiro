const { timedQuery, runMutation } = require("./repositorySupport");

function mapTicketType(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price || 0),
    description: row.description || "",
    bundleQuantity: Math.max(1, Number(row.bundle_quantity || 1)),
    active: row.active !== false
  };
}

async function findById(id) {
  const result = await timedQuery(null, "SELECT * FROM ticket_types WHERE id = $1", [id], { repository: "ticket_type", operation: "findById" });
  return mapTicketType(result.rows[0]);
}

async function recalculateSessionPrices(client, sessionIds = null) {
  const values = [];
  const filter = Array.isArray(sessionIds)
    ? (values.push(sessionIds), "WHERE session_ticket_types.session_id = ANY($1::text[])")
    : "";
  const result = await timedQuery(client, `WITH ranked AS (
      SELECT session_ticket_types.session_id, ticket_types.price,
        row_number() OVER (PARTITION BY session_ticket_types.session_id ORDER BY session_ticket_types.position) AS position
      FROM session_ticket_types
      JOIN ticket_types ON ticket_types.id = session_ticket_types.ticket_type_id
      ${filter}
    ), prices AS (
      SELECT session_id,
        max(price) FILTER (WHERE position = 1) AS first_price,
        max(price) FILTER (WHERE position = 2) AS second_price
      FROM ranked GROUP BY session_id
    )
    UPDATE sessions SET price_full = prices.first_price,
      price_half = COALESCE(prices.second_price, prices.first_price), updated_at = now()
    FROM prices WHERE sessions.id = prices.session_id
    RETURNING sessions.id`, values, { repository: "ticket_type", operation: "sessions.reprice" });
  return result.rows.map((row) => row.id);
}

async function upsert(ticket, options = {}) {
  return runMutation({
    event: options.event || "repository.ticket_type.update",
    metadata: { repository: "ticket_type", operation: options.operation || "upsert", ticketTypeId: ticket.id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO ticket_types
      (id, name, price, description, active, bundle_quantity, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,now())
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price,
        description=EXCLUDED.description, active=EXCLUDED.active,
        bundle_quantity=EXCLUDED.bundle_quantity, updated_at=now()
      RETURNING *`, [ticket.id, ticket.name, Number(ticket.price || 0), ticket.description || "", ticket.active !== false, Number(ticket.bundleQuantity || 1)], { repository: "ticket_type", operation: "upsert" });
    const sessionIds = await recalculateSessionPrices(client);
    return { ticket: mapTicketType(result.rows[0]), sessionIds };
  });
}

async function create(ticket, options = {}) {
  return upsert(ticket, { ...options, event: "repository.ticket_type.create", operation: "create" });
}

async function update(ticket, options = {}) {
  return upsert(ticket, { ...options, event: "repository.ticket_type.update", operation: "update" });
}

async function remove(id, options = {}) {
  return runMutation({
    event: "repository.ticket_type.delete",
    metadata: { repository: "ticket_type", operation: "delete", ticketTypeId: id },
    audit: options.audit
  }, async (client) => {
    const affected = await timedQuery(client, "SELECT DISTINCT session_id FROM session_ticket_types WHERE ticket_type_id = $1", [id], { repository: "ticket_type", operation: "sessions.find" });
    const sessionIds = affected.rows.map((row) => row.session_id);
    await timedQuery(client, "DELETE FROM session_ticket_types WHERE ticket_type_id = $1", [id], { repository: "ticket_type", operation: "links.delete" });
    const result = await timedQuery(client, "DELETE FROM ticket_types WHERE id = $1 RETURNING *", [id], { repository: "ticket_type", operation: "delete" });
    if (sessionIds.length) {
      await timedQuery(client, `INSERT INTO session_ticket_types (session_id, ticket_type_id, position)
        SELECT affected.session_id, ticket_types.id,
          row_number() OVER (PARTITION BY affected.session_id ORDER BY ticket_types.name)::integer * 10
        FROM unnest($1::text[]) affected(session_id)
        CROSS JOIN ticket_types
        WHERE ticket_types.active = true
          AND NOT EXISTS (SELECT 1 FROM session_ticket_types current WHERE current.session_id = affected.session_id)
        ON CONFLICT DO NOTHING`, [sessionIds], { repository: "ticket_type", operation: "links.fallback" });
      await recalculateSessionPrices(client, sessionIds);
    }
    return { ticket: mapTicketType(result.rows[0]), sessionIds };
  });
}

module.exports = { mapTicketType, findById, create, update, remove, recalculateSessionPrices };
