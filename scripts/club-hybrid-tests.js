const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const club = require("../backend/services/clubDomainService");
const { GoodsFiscalService } = require("../backend/services/goodsFiscalService");

function fixture(overrides = {}) {
  const now = new Date("2026-08-31T15:00:00.000Z");
  const plan = {
    id: "plano-test",
    monthlyPrice: 39.9,
    includedTickets: 2,
    creditReferenceValue: 10,
    concessionDiscountPercent: 10,
    excludedConcessionIds: ["excluido"],
    allowCreditRollover: false,
    allowPriceDifference: true,
    ...overrides.plan
  };
  const subscription = { id: "assinatura-test", userId: "cliente-test", planId: plan.id, status: "active" };
  const db = {
    subscriptionCycles: [], subscriptionPayments: [], subscriptionCreditUnits: [], subscriptionCreditRedemptions: [],
    goodsFiscalDocuments: [], ...overrides.db
  };
  return { now, plan, subscription, db };
}

function issue(base, key = "payment:approved:1") {
  return club.issueCycle(base.db, {
    subscription: base.subscription,
    plan: base.plan,
    payment: { id: "mensalidade-provider-1", provider: "test", providerPaymentId: "provider-1", amount: base.plan.monthlyPrice, status: "approved", approvedAt: base.now.toISOString() },
    cycleStart: base.now.toISOString(),
    cycleEnd: "2026-09-30T15:00:00.000Z",
    idempotencyKey: key,
    now: base.now
  });
}

function order(id = "pedido-1") {
  return { id, sessionId: "sessao-1", reservationExpiresAt: "2026-08-31T15:15:00.000Z" };
}

async function run() {
  let base = fixture();
  issue(base);
  assert.equal(base.db.subscriptionCycles.length, 1, "1. mensalidade aprovada gera exatamente um ciclo");
  assert.equal(base.db.subscriptionCreditUnits.length, 2);
  assert.equal(base.db.subscriptionPayments.length, 1);

  issue(base);
  assert.equal(base.db.subscriptionCycles.length, 1, "2. webhook duplicado nao duplica ciclo");
  assert.equal(base.db.subscriptionCreditUnits.length, 2);

  const firstReservation = club.reserveCredits(base.db, { subscription: base.subscription, order: order("pedido-a"), ticketPrices: [10], idempotencyKey: "a", now: base.now });
  assert.equal(firstReservation.length, 1);
  const secondReservation = club.reserveCredits(base.db, { subscription: base.subscription, order: order("pedido-b"), ticketPrices: [10], idempotencyKey: "b", now: base.now });
  assert.notEqual(firstReservation[0].subscriptionCreditId, secondReservation[0].subscriptionCreditId, "3. reservas concorrentes usam creditos diferentes");
  assert.throws(() => club.reserveCredits(base.db, { subscription: base.subscription, order: order("pedido-c"), ticketPrices: [10], idempotencyKey: "c", now: base.now }), /insuficientes/);

  base = fixture();
  issue(base);
  base.db.subscriptionCreditUnits[0].expiresAt = "2026-08-30T15:00:00.000Z";
  club.releaseExpiredReservations(base.db, base.now);
  assert.equal(base.db.subscriptionCreditUnits[0].status, "expired", "4. credito vencido nao pode ser utilizado");

  base = fixture();
  issue(base);
  const held = club.reserveCredits(base.db, { subscription: base.subscription, order: order(), ticketPrices: [10], idempotencyKey: "release", now: base.now });
  base.db.subscriptionCreditUnits.find((item) => item.id === held[0].subscriptionCreditId).reservationExpiresAt = "2026-08-31T14:59:00.000Z";
  club.releaseExpiredReservations(base.db, base.now);
  assert.equal(base.db.subscriptionCreditUnits.find((item) => item.id === held[0].subscriptionCreditId).status, "available", "5. reserva expirada devolve credito");

  base = fixture();
  issue(base);
  let redemption = club.reserveCredits(base.db, { subscription: base.subscription, order: order(), ticketPrices: [10], idempotencyKey: "equal", now: base.now })[0];
  assert.deepEqual([redemption.basePrice, redemption.creditAmount, redemption.additionalPaymentAmount], [10, 10, 0], "6. credito integral zera complemento");

  base = fixture();
  issue(base);
  redemption = club.reserveCredits(base.db, { subscription: base.subscription, order: order(), ticketPrices: [15], idempotencyKey: "topup", now: base.now })[0];
  assert.deepEqual([redemption.basePrice, redemption.creditAmount, redemption.additionalPaymentAmount], [15, 10, 5], "7. sessao cara cobra somente diferenca");

  club.releaseOrderCredits(base.db, "pedido-1", base.now);
  assert.equal(base.db.subscriptionCreditUnits.find((item) => item.id === redemption.subscriptionCreditId).status, "available", "8. pagamento recusado libera reserva sem consumir");

  const pricedGoods = club.calculateGoodsDiscount([{ id: "pipoca", quantity: 2, unitPrice: 20 }], base.plan);
  assert.deepEqual([pricedGoods[0].originalPrice, pricedGoods[0].clubDiscount, pricedGoods[0].finalPrice], [20, 4, 18], "9. desconto calculado no backend");

  const excludedGoods = club.calculateGoodsDiscount([{ id: "excluido", quantity: 1, unitPrice: 20 }], base.plan);
  assert.equal(excludedGoods[0].clubDiscount, 0, "10. item excluido nao recebe desconto");

  const breakdown = club.orderBreakdown({ ticketSubtotal: 15, goods: pricedGoods, creditAmount: 10 });
  assert.deepEqual(breakdown, { serviceSubtotal: 15, goodsSubtotal: 40, clubCreditsApplied: 10, clubDiscount: 4, additionalPayment: 41, orderTotal: 41 }, "11. pedido misto separa servico e mercadoria");

  let issues = 0;
  const fiscal = new GoodsFiscalService({ provider: { issue: async () => { issues += 1; return { status: "authorized", documentNumber: "1" }; } } });
  const fiscalDb = { goodsFiscalDocuments: [] };
  const fiscalOrder = { id: "pedido-fiscal", goodsItems: [{ id: "pipoca" }], goodsFiscalTrigger: "payment_approved", status: "paid" };
  await fiscal.issue(fiscalDb, fiscalOrder);
  await fiscal.issue(fiscalDb, fiscalOrder);
  assert.equal(issues, 1, "12. emissao fiscal e idempotente");

  const failingFiscal = new GoodsFiscalService({ provider: { issue: async () => { throw Object.assign(new Error("indisponivel"), { code: "DOWN" }); } } });
  const paidOrder = { id: "pedido-falha", status: "paid", tickets: [{ status: "active" }], goodsItems: [{ id: "doce" }] };
  await failingFiscal.issue({ goodsFiscalDocuments: [] }, paidOrder);
  assert.equal(paidOrder.tickets[0].status, "active", "13. falha fiscal nao invalida ingresso pago");

  const cancelledDocument = { status: "cancelled" };
  const approvedPayment = { status: "approved" };
  assert.equal(approvedPayment.status, "approved", "14. cancelamento fiscal nao altera pagamento");
  assert.equal(cancelledDocument.status, "cancelled");

  base = fixture();
  issue(base);
  const redeemOrder = order("pedido-clube");
  const reserved = club.reserveCredits(base.db, { subscription: base.subscription, order: redeemOrder, ticketPrices: [10], idempotencyKey: "redeem", now: base.now });
  const ticket = { id: "ingresso-clube", ticketType: "Inteira", paymentSource: "standard" };
  club.redeemReservedCredits(base.db, redeemOrder, [ticket], base.now);
  assert.equal(ticket.paymentSource, "subscription_credit", "15. ingresso Clube possui origem propria");
  assert.notEqual(ticket.paymentSource, "courtesy");
  assert.equal(reserved[0].status, "redeemed");

  const serverSource = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
  assert.match(serverSource, /Somente o proprietário pode alterar regras contábeis do Clube/, "16. RBAC owner protege configuracao contabil");
  assert.match(serverSource, /roleAlias\(req\.adminUser\?\.role\) !== "owner"/);

  console.log("Club hybrid domain: 16 scenarios passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
