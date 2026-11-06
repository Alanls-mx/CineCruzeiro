import { test } from "node:test";
import assert from "node:assert/strict";
import cancellationFactory from "../backend/services/pointPaymentCancellationHandler.js";

function fixture({ providerId = "ord-provedor", providerStatus = "pending", cancelStatus = "processing" } = {}) {
  let persisted = { payments: [{ id: "pagamento", orderId: "pedido", providerPaymentId: providerId, amount: 10,
    status: "pending", metadata: { kind: "point_sale", pointCreateState: "known", providerStatus: "pending" } }], orders: [{ id: "pedido", status: "pending_payment" }] };
  const events = [];
  const responses = [];
  const handler = cancellationFactory.createPointPaymentCancellationHandler({
    getAdminUser: () => ({ id: "operador" }),
    sendJson: (_res, status, payload) => { events.push("response"); responses.push({ status, payload }); },
    withCriticalMutation: async (fn) => fn(),
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => { persisted = structuredClone(db); events.push("commit"); },
    integrationConfigService: { resolvedConfig: () => ({}) },
    cardTerminalProvider: {
      getStatus: async () => ({ status: providerStatus, externalReference: "referencia", amount: 10, providerStatus }),
      cancelPayment: async (_id, _config, options) => { events.push(`cancel:${options.idempotencyKey}`); return { status: cancelStatus, externalReference: "referencia", amount: 10 }; }
    },
    mercadoPagoReferenceMatches: (_payment, reference) => reference === "referencia",
    applyPointPaymentStatus: (_db, payment, provider) => { payment.status = provider.status; return { orders: persisted.orders, tickets: [] }; },
    logEvent: () => {}
  });
  return { events, responses, read: () => persisted, run: () => handler({ req: {}, res: {}, db: persisted, pathname: "/api/box-office/point-payments/pagamento/cancel", method: "POST" }) };
}

test("202 preserva estado inconclusivo e mesma chave de cancelamento", async () => {
  const state = fixture();
  assert.equal(await state.run(), true);
  assert.equal(state.responses[0].status, 202);
  assert.equal(state.responses[0].payload.cancellationPending, true);
  assert.equal(state.read().payments[0].metadata.cancellationIdempotencyKey, "cancel-pagamento");
  assert.deepEqual(state.events, ["cancel:cancel-pagamento", "commit", "response"]);
});

test("cancelamento terminal retorna 200 somente após confirmação", async () => {
  const state = fixture({ cancelStatus: "cancelled" });
  await state.run();
  assert.equal(state.responses[0].status, 200);
  assert.equal(state.responses[0].payload.cancellationPending, false);
  assert.equal(state.read().payments[0].status, "cancelled");
});

test("intenção preparada sem envio cancela localmente sem chamar provedor", async () => {
  const state = fixture({ providerId: "" });
  state.read().payments[0].metadata.pointCreateState = "prepared";
  await state.run();
  assert.equal(state.responses[0].status, 200);
  assert.equal(state.events.includes("cancel:cancel-pagamento"), false);
  assert.equal(state.read().payments[0].metadata.pointCreateState, "cancelled_before_send");
});

test("aprovação concorrente bloqueia cancelamento", async () => {
  const state = fixture({ providerStatus: "approved" });
  await state.run();
  assert.equal(state.responses[0].status, 409);
  assert.equal(state.responses[0].payload.error.code, "POINT_ALREADY_APPROVED");
  assert.equal(state.events.includes("cancel:cancel-pagamento"), false);
});
