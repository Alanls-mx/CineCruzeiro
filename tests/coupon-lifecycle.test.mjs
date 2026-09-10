import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  archiveExpiredCoupons,
  couponUsageHistory,
  couponUsageSummary,
  orderUsesCoupon
} = require("../backend/services/couponLifecycleService");

test("arquiva apenas cupons vencidos e preserva os dados comerciais", () => {
  const db = {
    promotions: [
      { id: "expired", title: "Expirado", couponCode: "FIM", active: true, endsAt: "2026-09-09T23:59:59-03:00" },
      { id: "future", title: "Futuro", couponCode: "VAI", active: true, endsAt: "2026-09-20T23:59:59-03:00" },
      { id: "editorial", title: "Oferta sem código", couponCode: "", active: true, endsAt: "2026-09-09T23:59:59-03:00" }
    ]
  };

  const result = archiveExpiredCoupons(db, new Date("2026-09-10T12:00:00-03:00"));

  assert.equal(result.changed, true);
  assert.deepEqual(result.archived.map((item) => item.id), ["expired"]);
  assert.equal(db.promotions[0].active, false);
  assert.equal(db.promotions[0].archiveReason, "expired");
  assert.ok(db.promotions[0].archivedAt);
  assert.equal(db.promotions[1].archivedAt, undefined);
  assert.equal(db.promotions[2].archivedAt, undefined);
});

test("arquivamento é idempotente", () => {
  const db = { promotions: [{ id: "expired", couponCode: "FIM", endsAt: "2026-09-01T00:00:00Z", archivedAt: "2026-09-02T00:00:00Z" }] };
  const result = archiveExpiredCoupons(db, new Date("2026-09-10T12:00:00Z"));
  assert.equal(result.changed, false);
  assert.deepEqual(result.archived, []);
});

test("histórico relaciona cliente, filme, sessão, itens e valores", () => {
  const coupon = { id: "coupon-1", couponCode: "CINE20" };
  const db = {
    promotions: [coupon],
    users: [{ id: "user-1", name: "Cliente Cadastro", email: "cliente@example.com" }],
    movies: [{ id: "movie-1", title: "Filme do catálogo", sessions: [] }],
    orders: [
      {
        id: "order-1",
        status: "paid",
        couponId: "coupon-1",
        couponCode: "CINE20",
        couponDiscount: 12.5,
        totalPrice: 47.5,
        customerUserId: "user-1",
        movieId: "movie-1",
        movieTitle: "Filme preservado no pedido",
        sessionId: "session-1",
        sessionDate: "2026-09-10",
        sessionTime: "19:00",
        paidAt: "2026-09-10T18:30:00-03:00",
        ticketItems: [{ name: "Inteira", quantity: 2 }],
        concessionItems: [{ name: "Pipoca", quantity: 1 }]
      },
      { id: "pending", status: "pending_payment", couponId: "coupon-1", couponDiscount: 99 },
      { id: "other", status: "paid", couponId: "coupon-2", couponCode: "OUTRO", couponDiscount: 8 }
    ]
  };

  const summary = couponUsageSummary(db, coupon);
  const history = couponUsageHistory(db, coupon, { page: 1, pageSize: 20 });

  assert.deepEqual(summary, { usageCount: 1, discountGranted: 12.5 });
  assert.equal(history.total, 1);
  assert.equal(history.usages[0].customerName, "Cliente Cadastro");
  assert.equal(history.usages[0].customerEmail, "cliente@example.com");
  assert.equal(history.usages[0].movieTitle, "Filme preservado no pedido");
  assert.equal(history.usages[0].sessionTime, "19:00");
  assert.deepEqual(history.usages[0].ticketItems, ["2x Inteira"]);
  assert.deepEqual(history.usages[0].concessionItems, ["1x Pipoca"]);
  assert.equal(history.usages[0].discountAmount, 12.5);
});

test("histórico aceita pedidos antigos vinculados somente pelo código e pagina", () => {
  const coupon = { id: "coupon-1", couponCode: "LEGADO" };
  const db = {
    promotions: [coupon],
    users: [],
    movies: [],
    orders: Array.from({ length: 3 }, (_, index) => ({
      id: `order-${index + 1}`,
      status: "paid",
      couponCode: "legado",
      couponDiscount: index + 1,
      paidAt: `2026-09-0${index + 1}T12:00:00Z`
    }))
  };

  assert.equal(orderUsesCoupon(db.orders[0], coupon), true);
  const secondPage = couponUsageHistory(db, coupon, { page: 2, pageSize: 2 });
  assert.equal(secondPage.page, 2);
  assert.equal(secondPage.pages, 2);
  assert.equal(secondPage.total, 3);
  assert.deepEqual(secondPage.usages.map((usage) => usage.orderId), ["order-1"]);
});
