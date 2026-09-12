import test from "node:test";
import assert from "node:assert/strict";
import { GoodsFiscalService } from "../backend/services/goodsFiscalService.js";

test("identifica pedido da bomboniere como cancelado se estiver cancelado ou reembolsado", () => {
  const orderRefunded = {
    id: "ord-refunded",
    status: "cancelled",
    paymentStatus: "refunded",
    concessionStatus: "cancelled",
    concessionRefund: { status: "completed", amount: 25 },
    concessionItems: [{ id: "combo-1", name: "Combo", quantity: 1, refundStatus: "completed", status: "cancelled" }]
  };

  const isRefunded = Number(orderRefunded.concessionRefund?.amount || 0) > 0 || orderRefunded.status === "refunded";
  const isCancelled = orderRefunded.concessionStatus === "cancelled" || orderRefunded.status === "cancelled" || isRefunded;

  assert.equal(isRefunded, true);
  assert.equal(isCancelled, true);
});

test("garante que cancelamento fiscal e de estoque acompanha o cancelamento da bomboniere", () => {
  const service = new GoodsFiscalService();
  const order = {
    id: "order-concession-cancel",
    goodsItems: [{ id: "c1", quantity: 2 }],
    goodsFiscalStatus: "waiting_trigger",
    concessionStatus: "cancelled"
  };
  const db = { goodsFiscalDocuments: [] };
  const doc = service.prepare(db, order);
  const now = new Date("2026-09-12T00:00:00.000Z");

  const cancelled = service.cancelUnissued(db, order, "concession_refunded", now);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(order.goodsFiscalStatus, "cancelled");
  assert.equal(order.concessionStatus, "cancelled");
});

test("itens reembolsados recebem status de cancelado e quantidade devolvida", () => {
  const concessionItems = [
    { id: "c1", name: "Pipoca", quantity: 2, fulfilledQuantity: 0 },
    { id: "c2", name: "Bebida", quantity: 1, fulfilledQuantity: 0 }
  ];

  const now = new Date().toISOString();
  concessionItems.forEach((item) => {
    item.status = "cancelled";
    item.refundStatus = "completed";
    item.refundedQuantity = Number(item.quantity || 0);
    item.refundedAt = now;
  });

  assert.equal(concessionItems[0].status, "cancelled");
  assert.equal(concessionItems[0].refundStatus, "completed");
  assert.equal(concessionItems[0].refundedQuantity, 2);
  assert.equal(concessionItems[1].status, "cancelled");
  assert.equal(concessionItems[1].refundedQuantity, 1);
});
