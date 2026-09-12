import test from "node:test";
import assert from "node:assert/strict";
import recognitionModule from "../backend/services/financialRecognitionService.js";

const {
  applyCompletedRefunds,
  isOrderFinanciallySettled,
  paymentFinancialState,
  paymentRefundedAmount,
  recognitionDate
} = recognitionModule;

test("pagamento integralmente reembolsado nao permanece como aprovado", () => {
  const payment = { status: "refunded", amount: 80, approvedAt: "2026-09-10T12:00:00Z", refundedAt: "2026-09-11T12:00:00Z" };
  assert.deepEqual(paymentFinancialState(payment), {
    amount: 80,
    approved: false,
    fullyRefunded: true,
    refundedAmount: 80,
    netAmount: 0
  });
});

test("status aprovado com devolucao parcial reconhece somente o saldo liquido", () => {
  const payment = { status: "approved", amount: 100, refundedAmount: 35 };
  assert.deepEqual(paymentFinancialState(payment), {
    amount: 100,
    approved: true,
    fullyRefunded: false,
    refundedAmount: 35,
    netAmount: 65
  });
});

test("reembolso de ingresso reduz ingressos sem alterar a bomboniere", () => {
  const result = applyCompletedRefunds({
    ticketRevenue: 40,
    concessionRevenue: 25,
    order: { ticketRefund: { status: "completed", amount: 40 } },
    payment: { status: "approved", amount: 65, refundedAmount: 40 }
  });
  assert.deepEqual(result, {
    ticketRevenue: 0,
    concessionRevenue: 25,
    ticketRefunded: 40,
    concessionRefunded: 0,
    refundTotal: 40,
    fullyRefunded: false
  });
});

test("reembolso sem escopo e distribuido proporcionalmente", () => {
  const result = applyCompletedRefunds({
    ticketRevenue: 60,
    concessionRevenue: 40,
    order: {},
    payment: { status: "approved", amount: 100, refundedAmount: 25 }
  });
  assert.equal(result.ticketRefunded, 15);
  assert.equal(result.concessionRefunded, 10);
  assert.equal(result.ticketRevenue + result.concessionRevenue, 75);
});

test("evidencia do provedor prevalece sobre status atrasado do pedido", () => {
  const order = { status: "paid", paymentStatus: "approved", createdAt: "2026-09-09T10:00:00Z" };
  const payment = { status: "refunded", amount: 50, approvedAt: "2026-09-09T11:00:00Z" };
  assert.equal(isOrderFinanciallySettled(order, payment), true);
  assert.equal(paymentRefundedAmount(payment), 50);
  assert.equal(recognitionDate(order, payment), payment.approvedAt);
});
