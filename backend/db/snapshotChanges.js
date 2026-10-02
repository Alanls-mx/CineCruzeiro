const { createHash } = require("node:crypto");

const COLLECTIONS = Object.freeze({
  users: "users", rooms: "rooms", ticket_types: "ticketTypes", movies: "movies",
  concessions: "concessions", promotions: "promotions", ads: "ads", orders: "orders",
  payments: "payments", tickets: "tickets", subscription_plans: "subscriptionPlans",
  subscriptions: "subscriptions", subscription_credits: "subscriptionCredits",
  subscription_usage: "subscriptionUsage", subscription_cycles: "subscriptionCycles",
  subscription_payments: "subscriptionPayments", subscription_credit_units: "subscriptionCreditUnits",
  subscription_credit_redemptions: "subscriptionCreditRedemptions",
  subscription_accounting_rule_versions: "subscriptionAccountingRules",
  order_service_items: "orderServiceItems", order_goods_items: "orderGoodsItems",
  goods_fiscal_documents: "goodsFiscalDocuments"
});
const DELETE_ORDER = [
  "subscription_credit_redemptions", "subscription_usage", "subscription_payments",
  "subscription_credit_units", "subscription_cycles", "subscription_accounting_rule_versions",
  "goods_fiscal_documents", "order_service_items", "order_goods_items", "subscription_credits",
  "subscriptions", "subscription_plans", "tickets", "payments", "order_items", "orders",
  "session_ticket_types", "sessions", "concession_inventory", "concessions", "promotions",
  "ads", "webhook_events", "ticket_types", "movies", "rooms", "users"
];
const array = (value) => Array.isArray(value) ? value : [];
const key = (...parts) => JSON.stringify(parts.map(String));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const baselines = new WeakMap();

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])]));
  }
  return value;
}

function captureSnapshot(db) {
  const tables = new Map(DELETE_ORDER.map((table) => [table, new Map()]));
  const put = (table, id, value) => tables.get(table).set(String(id), hash(canonical(value)));
  for (const [table, collection] of Object.entries(COLLECTIONS)) {
    for (const item of array(db[collection])) {
      if (!item.id) throw new Error(`Registro sem identificador em ${collection}.`);
      const { sessions, ...movie } = item;
      put(table, item.id, table === "movies" ? movie : item);
    }
  }
  for (const movie of array(db.movies)) for (const session of array(movie.sessions)) {
    const { ticketTypeIds, ...fields } = session;
    put("sessions", session.id, { ...fields, movieId: movie.id });
    array(ticketTypeIds).forEach((id, index) => put("session_ticket_types", key(session.id, id), (index + 1) * 10));
  }
  for (const item of array(db.concessions)) {
    put("concession_inventory", item.id, { stock: item.stock, reserved: item.reserved, sold: item.sold });
  }
  for (const order of array(db.orders)) {
    put("order_items", order.id, { concessions: array(order.concessionItems), tickets: array(order.ticketItems) });
  }
  for (const event of array(db.webhookEvents)) put("webhook_events", key(event.provider || "unknown", event.eventId), event);
  const settings = { ...db.settings, integrations: db.integrations || db.settings?.integrations || {} };
  delete settings.emailCampaigns;
  return {
    tables,
    settings: new Map(Object.entries(settings).map(([name, value]) => [name, hash(canonical(value))])),
    auditIds: new Set(array(db.auditLogs).map((entry) => entry.id).filter(Boolean))
  };
}

function rememberSnapshot(db) {
  baselines.set(db, captureSnapshot(db));
  return db;
}

function snapshotBaseline(db) { return baselines.get(db); }

function changesBetween(before, after) {
  const tables = new Map();
  for (const [table, records] of after.tables) {
    const previous = before.tables.get(table) || new Map();
    tables.set(table, {
      changed: new Set([...records].filter(([id, fingerprint]) => previous.get(id) !== fingerprint).map(([id]) => id)),
      removed: new Set([...previous.keys()].filter((id) => !records.has(id)))
    });
  }
  return {
    tables,
    settingsChanged: [...after.settings].filter(([name, fingerprint]) => before.settings.get(name) !== fingerprint).map(([name]) => name),
    settingsRemoved: [...before.settings.keys()].filter((name) => !after.settings.has(name))
  };
}

function assertCurrent(before, current, changes) {
  const conflict = (entity) => {
    throw Object.assign(new Error("Os dados foram alterados por outra operação. Atualize e tente novamente."), {
      statusCode: 409, code: "DATABASE_CONCURRENT_CHANGE", entity
    });
  };
  for (const [table, change] of changes.tables) {
    for (const id of [...change.changed, ...change.removed]) {
      if (before.tables.get(table)?.get(id) !== current.tables.get(table)?.get(id)) conflict(table);
    }
  }
  for (const name of [...changes.settingsChanged, ...changes.settingsRemoved]) {
    if (before.settings.get(name) !== current.settings.get(name)) conflict("settings");
  }
}

async function deleteRemovedRows(client, changes) {
  for (const table of DELETE_ORDER) {
    const removed = [...changes.tables.get(table).removed];
    if (table === "sessions") continue;
    if (table === "order_items") {
      const owners = [...new Set([...removed, ...changes.tables.get(table).changed])];
      if (owners.length) await client.query("DELETE FROM order_items WHERE order_id = ANY($1::text[])", [owners]);
    } else if (["session_ticket_types", "webhook_events"].includes(table)) {
      const columns = table === "session_ticket_types" ? ["session_id", "ticket_type_id"] : ["provider", "event_id"];
      for (const encoded of removed) await client.query(`DELETE FROM ${table} WHERE ${columns[0]}=$1 AND ${columns[1]}=$2`, JSON.parse(encoded));
    } else if (removed.length) {
      const column = table === "concession_inventory" ? "concession_id" : "id";
      await client.query(`DELETE FROM ${table} WHERE ${column} = ANY($1::text[])`, [removed]);
    }
  }
}

async function deleteRemovedSessions(client, changes) {
  const removed = [...changes.tables.get("sessions").removed];
  if (removed.length) await client.query("DELETE FROM sessions WHERE id = ANY($1::text[])", [removed]);
}

// Only the fixed INSERT statements in postgresStore use this adapter. Values
// remain parameters; table/column names are validated against the snapshot model.
function createSnapshotWriter(client, changes) {
  return async (_client, sql, values = []) => {
    if (/^UPDATE tickets SET subscription_credit_id/.test(sql)) {
      if (!changes.tables.get("tickets").changed.has(String(values[0]))) return;
      return client.query(sql, values);
    }
    const match = sql.match(/^INSERT INTO ([a-z_]+)\s*\(([^)]+)\)/);
    if (!match || !changes.tables.has(match[1])) throw new Error("Instrução de persistência não reconhecida.");
    const [, table, rawColumns] = match;
    const columns = rawColumns.split(",").map((column) => column.trim());
    if (columns.some((column) => !/^[a-z_]+$/.test(column))) throw new Error("Coluna de persistência inválida.");
    const conflictColumns = table === "session_ticket_types" ? ["session_id", "ticket_type_id"]
      : table === "webhook_events" ? ["provider", "event_id"]
        : [table === "concession_inventory" ? "concession_id" : "id"];
    const recordKey = conflictColumns.length === 2 ? key(values[0], values[1]) : String(values[0]);
    if (!changes.tables.get(table).changed.has(recordKey)) return;
    if (table === "order_items" || /ON CONFLICT/i.test(sql)) return client.query(sql, values);
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column) && column !== "created_at");
    const compareColumns = updateColumns.filter((column) => column !== "updated_at");
    return client.query(`${sql} ON CONFLICT (${conflictColumns.join(",")}) DO UPDATE SET
      ${updateColumns.map((column) => `${column}=EXCLUDED.${column}`).join(",")}
      WHERE ROW(${compareColumns.map((column) => `${table}.${column}`).join(",")})
        IS DISTINCT FROM ROW(${compareColumns.map((column) => `EXCLUDED.${column}`).join(",")})`, values);
  };
}

module.exports = { captureSnapshot, rememberSnapshot, snapshotBaseline, changesBetween, assertCurrent, deleteRemovedRows, deleteRemovedSessions, createSnapshotWriter };
