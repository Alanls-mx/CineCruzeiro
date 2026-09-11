import test from "node:test";
import assert from "node:assert/strict";
import fiscalModule from "../backend/services/goodsFiscalService.js";

const { GoodsFiscalService } = fiscalModule;

test("cancela preparacao fiscal ainda nao emitida quando o pedido termina", () => {
  const service = new GoodsFiscalService();
  const order = {
    id: "order-terminal",
    goodsItems: [{ id: "goods-1", quantity: 1 }],
    goodsFiscalStatus: "waiting_trigger"
  };
  const db = { goodsFiscalDocuments: [] };
  const document = service.prepare(db, order);
  const now = new Date("2026-09-11T12:00:00.000Z");

  const cancelled = service.cancelUnissued(db, order, "order_expired", now);

  assert.equal(cancelled, document);
  assert.equal(document.status, "cancelled");
  assert.equal(document.cancelledAt, now.toISOString());
  assert.equal(document.metadata.cancellationReason, "order_expired");
  assert.equal(order.goodsFiscalStatus, "cancelled");
});

test("preserva documento fiscal autorizado", () => {
  const service = new GoodsFiscalService();
  const order = { id: "order-paid", goodsFiscalStatus: "authorized" };
  const document = {
    id: "fiscal-paid",
    orderId: order.id,
    status: "authorized",
    accessKey: "preserved",
    cancelledAt: ""
  };
  const db = { goodsFiscalDocuments: [document] };

  assert.equal(service.cancelUnissued(db, order), null);
  assert.equal(document.status, "authorized");
  assert.equal(document.accessKey, "preserved");
  assert.equal(document.cancelledAt, "");
  assert.equal(order.goodsFiscalStatus, "authorized");
});
