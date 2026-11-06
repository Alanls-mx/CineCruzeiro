import { test } from "node:test";
import assert from "node:assert/strict";
import pointFactory from "../backend/services/pointCreationCoordinator.js";

function fixture(createPayment) {
  let persisted = {
    orders: [{ id: "pedido", status: "pending_payment", reservationExpiresAt: "2099-01-01T00:00:00.000Z" }],
    payments: [{ id: "pagamento", orderId: "pedido", status: "pending", metadata: {
      kind: "point_sale", pointCreateState: "prepared", terminalId: "terminal",
      providerAccountFingerprint: "conta", recoveryRequest: {
        idempotencyKey: "chave-original", externalReference: "referencia-original", totalPrice: 10, description: "Ingresso"
      }
    } }]
  };
  const commits = [];
  const coordinator = pointFactory.createPointCreationCoordinator({
    withCriticalMutation: async (fn) => fn(),
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => { persisted = structuredClone(db); commits.push(persisted.payments[0].metadata.pointCreateState); },
    pointPaymentOrders: (db, payment) => db.orders.filter((order) => order.id === payment.orderId),
    pointProviderAccountFingerprint: () => "conta",
    cardTerminalProvider: { terminalConnection: async () => true, createPayment }
  });
  return { coordinator, commits, read: () => persisted, update: (fn) => fn(persisted) };
}

test("Point confirma claim e instante pré-envio antes de chamar provedor", async () => {
  const calls = [];
  let state;
  state = fixture(async (order, _config, recovery) => {
    calls.push({ order, recovery, commits: [...state.commits], metadata: structuredClone(state.read().payments[0].metadata) });
    return { id: "order-provedor", status: "pending" };
  });
  const result = await state.coordinator.attemptPointCreation("pagamento", { pointDeviceId: "terminal" });
  assert.equal(result.id, "order-provedor");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].commits, ["sending", "sending"]);
  assert.ok(calls[0].metadata.providerRequestSentAt);
  assert.equal(calls[0].recovery.idempotencyKey, "chave-original");
  assert.equal(calls[0].order.id, "referencia-original");
});

test("resposta perdida mantém a chave e bloqueia retry até vencer o lease", async () => {
  const keys = [];
  let fail = true;
  const state = fixture(async (_order, _config, recovery) => {
    keys.push(recovery.idempotencyKey);
    if (fail) throw Object.assign(new Error("resposta perdida"), { code: "POINT_CONNECTION_LOST" });
    return { id: "order-provedor" };
  });
  await assert.rejects(state.coordinator.attemptPointCreation("pagamento", { pointDeviceId: "terminal" }),
    (error) => error.code === "POINT_CONNECTION_LOST");
  assert.equal(state.read().payments[0].metadata.pointCreateState, "unknown");
  assert.equal(await state.coordinator.attemptPointCreation("pagamento", { pointDeviceId: "terminal" }), null);
  assert.equal(keys.length, 1);
  state.update((db) => { db.payments[0].metadata.pointCreateLeaseUntil = "2000-01-01T00:00:00.000Z"; });
  fail = false;
  assert.equal((await state.coordinator.attemptPointCreation("pagamento", { pointDeviceId: "terminal" })).id, "order-provedor");
  assert.deepEqual(keys, ["chave-original", "chave-original"]);
});

test("terminal divergente é barrado antes do envio", async () => {
  let requests = 0;
  const state = fixture(async () => { requests += 1; });
  await assert.rejects(state.coordinator.attemptPointCreation("pagamento", { pointDeviceId: "outro" }),
    (error) => error.code === "POINT_TERMINAL_PRECHECK_FAILED");
  assert.equal(requests, 0);
  assert.equal(state.read().payments[0].metadata.pointCreateState, "prepared");
  assert.equal(state.read().payments[0].metadata.providerRequestSentAt, undefined);
});
