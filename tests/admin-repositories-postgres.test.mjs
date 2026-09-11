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
const promotionRepository = require("../backend/repositories/promotionRepository");
const concessionRepository = require("../backend/repositories/concessionRepository");
const settingsRepository = require("../backend/repositories/settingsRepository");
const userRepository = require("../backend/repositories/userRepository");
const orderRepository = require("../backend/repositories/orderRepository");

async function counts() {
  const tables = ["users", "movies", "sessions", "orders", "payments", "tickets", "subscriptions", "promotions", "concessions", "audit_logs"];
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

test("segunda fase preserva dados e resolve concorrencia por entidade", { skip: !TEST_DATABASE_URL }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const promotionAId = `repo-promotion-a-${suffix}`;
  const promotionBId = `repo-promotion-b-${suffix}`;
  const concessionId = `repo-concession-${suffix}`;
  const userId = `repo-user-${suffix}`;
  const settingsA = `phaseTwoBranding${Date.now()}`;
  const settingsB = `phaseTwoEvent${Date.now()}`;
  const before = await counts();
  try {
    await Promise.all([
      promotionRepository.create({ id: promotionAId, title: "Cupom A", discountType: "percentage", value: 10, couponCode: `A${suffix}`, active: true }),
      promotionRepository.create({ id: promotionBId, title: "Cupom B", discountType: "fixed", value: 5, couponCode: `B${suffix}`, active: true })
    ]);
    const [promotionA, promotionB] = await Promise.all([
      promotionRepository.update({ id: promotionAId, title: "Cupom A atualizado", discountType: "percentage", value: 12, couponCode: `A${suffix}`, active: true }),
      promotionRepository.update({ id: promotionBId, title: "Cupom B atualizado", discountType: "fixed", value: 6, couponCode: `B${suffix}`, active: true })
    ]);
    assert.equal(promotionA.value, 12);
    assert.equal(promotionB.value, 6);

    await concessionRepository.create({ id: concessionId, sku: `SKU-${suffix}`, name: "Produto concorrente", price: 10, stock: 5, reserved: 0, sold: 0, active: true, tags: [], comboItems: [] });
    const movements = await Promise.allSettled([
      concessionRepository.updateInventory(concessionId, { available: -4, reserved: 4 }),
      concessionRepository.updateInventory(concessionId, { available: -4, reserved: 4 })
    ]);
    assert.equal(movements.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(movements.filter((item) => item.status === "rejected").length, 1);
    const inventory = await concessionRepository.findById(concessionId);
    assert.equal(inventory.stock, 1);
    assert.equal(inventory.reserved, 4);

    await Promise.all([
      settingsRepository.updateSection(settingsA, { logo: "nova" }),
      settingsRepository.updateSection(settingsB, { headline: "evento" })
    ]);
    const settings = await settingsRepository.getAppSettings();
    assert.deepEqual(settings[settingsA], { logo: "nova" });
    assert.deepEqual(settings[settingsB], { headline: "evento" });

    await userRepository.create({ id: userId, name: "Cliente Repository", email: `${userId}@example.com`, passwordHash: "hash-teste", role: "customer", active: true });
    await Promise.all([
      userRepository.updateFields(userId, { name: "Cliente Atualizado" }, { event: "repository.user.profile_update", operation: "profileUpdate" }),
      userRepository.incrementSessionVersion(userId)
    ]);
    const user = await userRepository.findById(userId);
    assert.equal(user.name, "Cliente Atualizado");
    assert.equal(user.sessionVersion, 1);
  } finally {
    await queryPostgres("DELETE FROM users WHERE id=$1", [userId]).catch(() => null);
    await queryPostgres("DELETE FROM concessions WHERE id=$1", [concessionId]).catch(() => null);
    await queryPostgres("DELETE FROM promotions WHERE id=ANY($1::text[])", [[promotionAId, promotionBId]]).catch(() => null);
    await queryPostgres("UPDATE settings SET value=value-$1-$2,updated_at=now() WHERE key='app'", [settingsA, settingsB]).catch(() => null);
  }
  assert.deepEqual(await counts(), before);
});

test("fase 3A cria pedido uma vez e preserva seus itens", { skip: !TEST_DATABASE_URL }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = `order-user-${suffix}`;
  const movieId = `order-movie-${suffix}`;
  const roomId = `order-room-${suffix}`;
  const ticketTypeId = `order-ticket-type-${suffix}`;
  const sessionId = `order-session-${suffix}`;
  const idempotencyKey = `checkout-${suffix}`;
  const order = (id) => ({
    id,
    idempotencyKey,
    customerUserId: userId,
    customerName: "Cliente Pedido",
    customerEmail: `${userId}@example.com`,
    movieId,
    sessionId,
    status: "pending_payment",
    subtotal: 28,
    discountValue: 3,
    totalPrice: 25,
    serviceSubtotal: 20,
    goodsSubtotal: 8,
    additionalPayment: 25,
    reservationExpiresAt: "2030-01-10T22:00:00.000Z",
    ticketItems: [{ id: ticketTypeId, name: "Inteira", quantity: 1, unitPrice: 20 }],
    concessionItems: [{ id: "pipoca-teste", name: "Pipoca", quantity: 1, unitPrice: 8 }],
    createdAt: new Date().toISOString()
  });
  const before = await counts();
  try {
    await userRepository.create({ id: userId, name: "Cliente Pedido", email: `${userId}@example.com`, passwordHash: "hash", role: "customer", active: true });
    await roomRepository.create({ id: roomId, name: "Sala Pedido", capacity: 20, technology: "2D", status: "active", seatSelectionEnabled: false, seatTypes: [], seatLayout: { screenLabel: "TELA", rows: [] } });
    await ticketTypeRepository.create({ id: ticketTypeId, name: "Inteira Pedido", price: 20, description: "Teste", bundleQuantity: 1, active: true });
    await movieRepository.create({ id: movieId, slug: movieId, workflowStatus: "draft", sortOrder: 100, status: "hidden", title: "Filme Pedido", genre: [], rating: "L", metadata: {}, sessions: [] });
    await sessionRepository.create(movieId, { id: sessionId, date: "2030-01-10", time: "19:00", format: "2D", room: "Sala Pedido (2D)", roomId, ticketTypeIds: [ticketTypeId], priceFull: 20, priceHalf: 10, status: "available" });

    const results = await Promise.all([
      orderRepository.create(order(`order-a-${suffix}`)),
      orderRepository.create(order(`order-b-${suffix}`))
    ]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(new Set(results.map((result) => result.order.id)).size, 1);
    const saved = await orderRepository.findByIdempotencyKey(idempotencyKey);
    assert.equal(saved.totalPrice, 25);
    assert.equal(saved.ticketItems.length, 1);
    assert.equal(saved.concessionItems.length, 1);

    const statusResults = await Promise.all([
      orderRepository.updateStatus(saved.id, "expired", ["pending_payment"], { expiredAt: new Date().toISOString() }),
      orderRepository.updateStatus(saved.id, "expired", ["pending_payment"], { expiredAt: new Date().toISOString() })
    ]);
    assert.equal(statusResults.filter((result) => result.changed).length, 1);
    assert.equal((await orderRepository.findById(saved.id)).status, "expired");
  } finally {
    await queryPostgres("DELETE FROM orders WHERE idempotency_key=$1", [idempotencyKey]).catch(() => null);
    await queryPostgres("DELETE FROM movies WHERE id=$1", [movieId]).catch(() => null);
    await queryPostgres("DELETE FROM ticket_types WHERE id=$1", [ticketTypeId]).catch(() => null);
    await queryPostgres("DELETE FROM rooms WHERE id=$1", [roomId]).catch(() => null);
    await queryPostgres("DELETE FROM users WHERE id=$1", [userId]).catch(() => null);
  }
  assert.deepEqual(await counts(), before);
});
