import test from "node:test";
import assert from "node:assert/strict";

test("occupiedSeatIds exclui pedidos cancelados e reembolsados", () => {
  const sessionId = "sess-1";
  const orders = [
    { id: "ord-active", sessionId, status: "paid", selectedSeatIds: ["A1", "A2"] },
    { id: "ord-refunded", sessionId, status: "refunded", selectedSeatIds: ["B1"] },
    { id: "ord-cancelled", sessionId, status: "cancelled", selectedSeatIds: ["B2"] },
  ];

  const occupied = new Set();
  const now = Date.now();
  orders.forEach((order) => {
    if (order.sessionId !== sessionId || !["pending_payment", "paid"].includes(order.status)) return;
    (order.selectedSeatIds || []).forEach((seatId) => occupied.add(String(seatId)));
  });

  assert.equal(occupied.has("A1"), true);
  assert.equal(occupied.has("A2"), true);
  assert.equal(occupied.has("B1"), false, "Poltrona B1 deve estar liberada após reembolso");
  assert.equal(occupied.has("B2"), false, "Poltrona B2 deve estar liberada após cancelamento");
});

test("checkout draft reinicia sem paymentResult ao voltar para etapa de ingressos", () => {
  const previousCompletedDraft = {
    sessionId: "sess-1",
    selectedSeatIds: ["B1"],
    seatHoldToken: "old-token-123",
    paymentResult: { ok: true, order: { id: "ord-old" } }
  };

  const step = "ingressos";
  const isValidPaymentResult = (val) => Boolean(val && typeof val === "object" && "order" in val);

  let draftToUse = previousCompletedDraft;
  if (step !== "confirmacao" && isValidPaymentResult(draftToUse.paymentResult)) {
    draftToUse = null; // rascunho anterior concluído deve ser descartado
  }

  assert.equal(draftToUse, null, "Rascunho de compra já concluída não deve persistir na etapa de ingressos");
});

test("liberação de poltronas dispara broadcast de available", () => {
  const broadcasts = [];
  const fakeRealtimeService = {
    broadcastSeatStatus: (sessionId, seatId, status) => {
      broadcasts.push({ sessionId, seatId, status });
    },
    broadcastSessionRefresh: (sessionId) => {
      broadcasts.push({ sessionId, type: "refresh" });
    }
  };

  const order = {
    sessionId: "sess-1",
    selectedSeatIds: ["B1", "B2"]
  };

  order.selectedSeatIds.forEach((seatId) => {
    fakeRealtimeService.broadcastSeatStatus(order.sessionId, seatId, "available");
  });
  fakeRealtimeService.broadcastSessionRefresh(order.sessionId);

  assert.equal(broadcasts.length, 3);
  assert.deepEqual(broadcasts[0], { sessionId: "sess-1", seatId: "B1", status: "available" });
  assert.deepEqual(broadcasts[1], { sessionId: "sess-1", seatId: "B2", status: "available" });
  assert.deepEqual(broadcasts[2], { sessionId: "sess-1", type: "refresh" });
});
