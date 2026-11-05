import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATA_STORE = "postgres";
}
const require = createRequire(import.meta.url);
const { assertDisposableTestDatabase } = require("../scripts/test-postgres-safety.js");
test.beforeEach(async () => { if (enabled) await assertDisposableTestDatabase(); });
const store = require("../backend/db/postgresStore");
const repository = require("../backend/repositories/movieRepository");
const sessions = require("../backend/repositories/sessionRepository");

test("catalog deletion in PostgreSQL preserves sales and rejects stale writes", { skip: !enabled }, async () => {
  const prefix = `catalog-qa-${Date.now()}`;
  const make = (name) => ({ id: `${prefix}-${name}`, slug: `${prefix}-${name}`, title: name, workflowStatus: "draft", status: "upcoming", sessions: [], metadata: {} });
  const historical = make("historical");
  const unused = make("unused");
  const booked = make("booked");
  const roomId = `${prefix}-room`;
  const pastId = `${prefix}-past`;
  const futureId = `${prefix}-future`;
  const session = (id, date) => ({ id, date, time: "19:00", roomId, room: "Sala QA", format: "2D", ticketTypeIds: [], priceFull: 20, priceHalf: 10, status: "available" });
  try {
    await store.queryPostgres("INSERT INTO rooms (id,name,capacity,technology,status) VALUES ($1,'QA',20,'2D','active')", [roomId]);
    for (const movie of [historical, unused, booked]) await repository.create(movie);
    await sessions.create(historical.id, session(pastId, "2020-01-01"));
    await sessions.create(booked.id, session(futureId, "2099-01-01"));
    await store.queryPostgres(`INSERT INTO orders (id, customer_name, movie_id, session_id, status, total)
      VALUES ($1,'QA',$2,$3,'paid',20), ($4,'QA',$5,$6,'paid',20)`,
    [`${prefix}-order-old`, historical.id, pastId, `${prefix}-order-future`, booked.id, futureId]);
    assert.equal((await repository.removeFromCatalog(unused.id)).historyPreserved, false);
    assert.equal(await repository.findById(unused.id), null);
    await assert.rejects(repository.removeFromCatalog(booked.id), (error) => error.statusCode === 409);
    const result = await repository.removeFromCatalog(historical.id);
    assert.equal(result.historyPreserved, true);
    assert.ok((await repository.findById(historical.id)).metadata.catalogDeletedAt);
    const orders = await store.queryPostgres("SELECT total,movie_id,session_id FROM orders WHERE id=$1", [`${prefix}-order-old`]);
    assert.equal(Number(orders.rows[0].total), 20);
    assert.equal(orders.rows[0].movie_id, historical.id);
    assert.equal(orders.rows[0].session_id, pastId);
    await assert.rejects(repository.update(historical), (error) => error.statusCode === 409);
    await assert.rejects(sessions.create(historical.id, session(`${prefix}-late`, "2099-01-02")), (error) => error.statusCode === 409);
    const rows = await store.queryPostgres("SELECT count(*) AS count FROM sessions WHERE movie_id=$1", [historical.id]);
    assert.equal(Number(rows.rows[0].count), 1);
  } finally {
    await store.queryPostgres("DELETE FROM orders WHERE id=ANY($1::text[])", [[`${prefix}-order-old`, `${prefix}-order-future`]]);
    await store.queryPostgres("DELETE FROM movies WHERE id=ANY($1::text[])", [[historical.id, unused.id, booked.id]]);
    await store.queryPostgres("DELETE FROM rooms WHERE id=$1", [roomId]);
    await store.closePostgres();
  }
});
