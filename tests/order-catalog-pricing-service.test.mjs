import { test } from "node:test";
import assert from "node:assert/strict";
import catalogPricing from "../backend/services/orderCatalogPricingService.js";
import ticketSelection from "../backend/services/orderTicketSelectionService.js";
import pricing from "../backend/services/checkoutPricingService.js";

const service = catalogPricing.createOrderCatalogPricingService({
  todayIsoDate: () => "2026-11-06",
  sessionSalesOpenAt: () => null,
  isSessionSellable: () => true,
  resolveOrderTicketItems: ticketSelection.resolveOrderTicketItems,
  roomForSession: () => ({ capacity: 2 }),
  roomSeatSelectionEnabled: () => false,
  roomSeats: () => [],
  orderTicketCount: () => 1,
  concessionStockConsumption: (_item, _orderItem, quantity) => quantity,
  finiteStock: () => true,
  applyCouponPricing: () => ({ discountValue: 0, ticketDiscount: 0, concessionDiscount: 0, coupon: null }),
  prioritizeClubCreditsInCouponPricing: (_db, _order, _items, _ticketTotal, _concessionTotal, couponPricing) => couponPricing,
  allocateDiscountAcrossAmounts: pricing.allocateDiscountAcrossAmounts,
  roomDisplayLabel: () => "Sala A",
  ensureFriendlyOrderReference: (_db, order) => { order.reference = "REF-1"; },
  assignSeatsToOrder: (_db, order) => ({ ...order, seatAssignmentReached: true })
});

const db = () => ({
  movies: [{ id: "filme", title: "Filme", sessions: [{ id: "sessao", date: "2026-11-06", time: "21:00", format: "2D" }] }],
  ticketTypes: [{ id: "inteira", name: "Inteira", price: 10, active: true }],
  concessions: [{ id: "pipoca", name: "Pipoca", sku: "P", price: 5, stock: 1 }],
  tickets: [], orders: []
});

test("pedido usa preços do catálogo, inclui extras e só chama atribuição quando solicitada", () => {
  const input = { movieId: "filme", sessionId: "sessao", ticketItems: [{ id: "inteira", quantity: 1 }], concessionItems: [{ id: "pipoca", quantity: 1, unitPrice: 0 }] };
  const withoutSeats = service.repriceOrderFromCatalog(db(), input, { assignSeats: false });
  assert.equal(withoutSeats.totalPrice, 15);
  assert.equal(withoutSeats.concessionItems[0].unitPrice, 5);
  assert.equal(withoutSeats.seatAssignmentReached, undefined);
  assert.equal(withoutSeats.reference, "REF-1");
  assert.equal(service.repriceOrderFromCatalog(db(), input).seatAssignmentReached, true);
  assert.doesNotThrow(() => service.assertClientPricingMatches({ totalPrice: 15 }, withoutSeats));
  assert.throws(() => service.assertClientPricingMatches({ totalPrice: 10 }, withoutSeats),
    (error) => error.code === "CLIENT_PRICE_MISMATCH" && error.statusCode === 409);
});

test("estoque e capacidade são revalidados antes da criação do pedido", () => {
  const input = { movieId: "filme", sessionId: "sessao", ticketItems: [{ id: "inteira", quantity: 1 }], concessionItems: [{ id: "pipoca", quantity: 2 }] };
  assert.throws(() => service.repriceOrderFromCatalog(db(), input), (error) => error.statusCode === 409);
  const full = db();
  full.tickets.push({ sessionId: "sessao", status: "active" }, { sessionId: "sessao", status: "active" });
  assert.throws(() => service.repriceOrderFromCatalog(full, { ...input, concessionItems: [] }), (error) => error.statusCode === 409);
});

test("venda de balcão exige produto e valida estoque do catálogo", () => {
  assert.throws(() => service.repriceConcessionCounterOrder(db(), { concessionItems: [] }),
    (error) => error.code === "CONCESSION_ITEMS_REQUIRED" && error.statusCode === 422);
  const order = service.repriceConcessionCounterOrder(db(), { concessionItems: [{ id: "pipoca", quantity: 1 }] });
  assert.equal(order.totalPrice, 5);
  assert.equal(order.ticketItems.length, 0);
});
