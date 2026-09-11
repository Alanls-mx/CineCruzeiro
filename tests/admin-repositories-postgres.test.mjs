import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL = "";
  process.env.DATA_STORE = "postgres";
}

const require = createRequire(import.meta.url);
const { queryPostgres } = require("../backend/db/postgresStore");
const movieRepository = require("../backend/repositories/movieRepository");
const sessionRepository = require("../backend/repositories/sessionRepository");
const roomRepository = require("../backend/repositories/roomRepository");
const ticketTypeRepository = require("../backend/repositories/ticketTypeRepository");

async function counts() {
  const tables = ["users", "movies", "sessions", "orders", "payments", "tickets", "subscriptions", "promotions", "audit_logs"];
  const values = {};
  for (const table of tables) {
    const result = await queryPostgres(`SELECT count(*)::integer AS total FROM ${table}`);
    values[table] = result.rows[0].total;
  }
  return values;
}

test("CRUD direcionado preserva contagens nao relacionadas e aceita concorrencia independente", { skip: !TEST_DATABASE_URL }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const roomId = `repo-room-${suffix}`;
  const ticketId = `repo-ticket-${suffix}`;
  const movieAId = `repo-movie-a-${suffix}`;
  const movieBId = `repo-movie-b-${suffix}`;
  const sessionId = `repo-session-${suffix}`;
  const room = { id: roomId, name: "Sala Repository", capacity: 20, technology: "2D", status: "active", seatSelectionEnabled: false, seatTypes: [], seatLayout: { screenLabel: "TELA", rows: [] } };
  const ticket = { id: ticketId, name: "Ingresso Repository", price: 12, description: "Teste", bundleQuantity: 1, active: true };
  const movie = (id, title) => ({ id, slug: id, workflowStatus: "draft", sortOrder: 100, status: "hidden", title, genre: [], rating: "L", metadata: {}, sessions: [] });
  try {
    await roomRepository.create(room);
    await ticketTypeRepository.create(ticket);
    await Promise.all([
      movieRepository.create(movie(movieAId, "Filme Repository A")),
      movieRepository.create(movie(movieBId, "Filme Repository B"))
    ]);
    await sessionRepository.create(movieAId, {
      id: sessionId, date: "2030-01-10", time: "19:00", format: "2D Dublado",
      room: "Sala Repository (2D)", roomId, ticketTypeIds: [ticketId], priceFull: 12, priceHalf: 12, status: "available"
    });
    const before = await counts();
    const [updatedA, updatedB] = await Promise.all([
      movieRepository.update({ ...movie(movieAId, "Filme Repository A Atualizado"), sessions: [await sessionRepository.findById(sessionId)] }),
      movieRepository.update(movie(movieBId, "Filme Repository B Atualizado"))
    ]);
    const after = await counts();
    assert.equal(updatedA.title, "Filme Repository A Atualizado");
    assert.equal(updatedB.title, "Filme Repository B Atualizado");
    assert.deepEqual(after, before);
  } finally {
    await queryPostgres("DELETE FROM movies WHERE id = ANY($1::text[])", [[movieAId, movieBId]]).catch(() => null);
    await queryPostgres("DELETE FROM ticket_types WHERE id = $1", [ticketId]).catch(() => null);
    await queryPostgres("DELETE FROM rooms WHERE id = $1", [roomId]).catch(() => null);
  }
});
