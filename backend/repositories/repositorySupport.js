const {
  queryPostgres,
  withPostgresTransaction,
  invalidatePostgresSnapshot
} = require("../db/postgresStore");

function safeMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => (
    value !== undefined && value !== null && ["string", "number", "boolean"].includes(typeof value)
  )));
}

function emitPerformance(event, durationMs, metadata = {}) {
  const payload = {
    level: durationMs >= 250 ? "warn" : "info",
    event,
    durationMs: Math.round(durationMs * 100) / 100,
    ...safeMetadata(metadata)
  };
  console.info(JSON.stringify(payload));
}

async function timedQuery(client, text, values = [], metadata = {}) {
  const startedAt = performance.now();
  try {
    return await (client?.query ? client.query(text, values) : queryPostgres(text, values));
  } finally {
    const verb = String(text || "").trim().split(/\s+/, 1)[0].toUpperCase();
    emitPerformance(verb === "SELECT" ? "database.read" : "database.write", performance.now() - startedAt, metadata);
  }
}

async function insertAudit(client, audit = {}) {
  if (!audit?.userId) return;
  await timedQuery(client, `INSERT INTO audit_logs
    (user_id, action, entity_type, entity_id, before, after, ip, created_at)
    VALUES ((SELECT id FROM users WHERE id = $1), $2, $3, $4, $5::jsonb, $6::jsonb, $7, now())`, [
    audit.userId,
    audit.action || "repository.update",
    audit.entityType || "system",
    audit.entityId || "",
    JSON.stringify(audit.before ?? null),
    JSON.stringify(audit.after ?? null),
    audit.ip || ""
  ], { repository: audit.entityType || "system", operation: "audit" });
}

async function runMutation({ event, metadata = {}, audit }, callback) {
  const startedAt = performance.now();
  try {
    const result = await withPostgresTransaction(async (client) => {
      const value = await callback(client);
      await insertAudit(client, audit);
      return value;
    });
    invalidatePostgresSnapshot();
    return result;
  } finally {
    const durationMs = performance.now() - startedAt;
    emitPerformance(event, durationMs, metadata);
    emitPerformance("transaction.duration", durationMs, { repository: metadata.repository || "", operation: metadata.operation || "" });
  }
}

module.exports = {
  emitPerformance,
  timedQuery,
  runMutation
};
