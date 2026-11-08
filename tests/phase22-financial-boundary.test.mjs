import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createMercadoPagoUnknownEventHandler } = require("../backend/services/mercadoPagoUnknownEventHandler.js");
const { createCheckoutPreviewRoutes } = require("../backend/services/checkoutPreviewRoutes.js");

test("verified unknown Mercado Pago event writes in the mutation and deduplicates", async () => {
  const events = [];
  const db = { webhookEvents: [] };
  const handler = createMercadoPagoUnknownEventHandler({
    withCriticalMutation: async (work) => { events.push("transaction"); await work(); events.push("commit"); },
    readDb: async () => db,
    writeDb: async () => { events.push("write"); },
    logEvent: () => {},
    sendJson: (_res, status, payload) => { events.push(`response:${status}:${payload.duplicate}`); }
  });
  const args = { res: {}, provider: "mercado_pago", eventId: "event-1", providerPaymentId: "ORDER-1", orderId: "order-1", requestId: "request-1", action: "unknown" };
  await handler(args);
  assert.deepEqual(events, ["transaction", "write", "response:200:false", "commit"]);
  assert.equal(db.webhookEvents[0].status, "ignored_unknown_event");
  events.length = 0;
  await handler(args);
  assert.deepEqual(events, ["transaction", "response:200:true", "commit"]);
  assert.equal(db.webhookEvents.length, 1);
});

test("failed unknown-event write cannot schedule an acknowledgment", async () => {
  const db = { webhookEvents: [] };
  let responses = 0;
  const handler = createMercadoPagoUnknownEventHandler({
    withCriticalMutation: async (work) => work(),
    readDb: async () => db,
    writeDb: async () => { throw new Error("write failed"); },
    logEvent: () => {},
    sendJson: () => { responses++; }
  });
  await assert.rejects(handler({ res: {}, provider: "mercado_pago", eventId: "event-2" }), /write failed/);
  assert.equal(responses, 0);
});

test("coupon preview retains auth, identity, no seat assignment and response contract", async () => {
  const responses = [];
  const user = { id: "customer-1", email: "synthetic@example.test", cpf: "12345678900" };
  let pricingInput;
  const handler = createCheckoutPreviewRoutes({
    getCustomerUser: () => user,
    readBody: async () => ({ order: { couponCode: "TEST" } }),
    normalizePaymentOrder: (input) => ({ ...input }),
    repriceOrderFromCatalog: (_db, input, options) => {
      pricingInput = { input, options };
      return { totalPrice: 8, couponDiscount: 2, couponId: "coupon-1", couponCode: "TEST", couponTitle: "Test", couponAllowsClubStacking: false };
    },
    sendJson: (_res, status, payload, headers) => responses.push({ status, payload, headers })
  });
  assert.equal(await handler({ req: {}, res: {}, pathname: "/api/coupons/preview", method: "POST", db: {} }), true);
  assert.deepEqual(pricingInput.options, { assignSeats: false });
  assert.equal(pricingInput.input.customerUserId, user.id);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].payload.subtotal, 10);
  assert.equal(responses[0].payload.total, 8);
  assert.equal(responses[0].headers["Cache-Control"], "no-store");
});

test("club preview preserves missing-subscription error and anonymous auth", async () => {
  const responses = [];
  let readCount = 0;
  const deps = {
    getCustomerUser: () => null,
    readBody: async () => { readCount++; return { order: {} }; },
    normalizePaymentOrder: (input) => input,
    repriceOrderFromCatalog: () => ({ totalPrice: 10 }),
    activeClubPlanForBenefits: () => null,
    sendJson: (_res, status, payload) => responses.push({ status, payload })
  };
  const args = { req: {}, res: {}, pathname: "/api/checkout/club-benefits/preview", method: "POST", db: {} };
  assert.equal(await createCheckoutPreviewRoutes(deps)(args), true);
  assert.equal(responses[0].status, 401);
  assert.equal(readCount, 0);
  deps.getCustomerUser = () => ({ id: "customer-1" });
  await assert.rejects(createCheckoutPreviewRoutes(deps)(args), (error) => error.code === "NO_ACTIVE_SUBSCRIPTION" && error.statusCode === 409);
  assert.equal(readCount, 1);
});
