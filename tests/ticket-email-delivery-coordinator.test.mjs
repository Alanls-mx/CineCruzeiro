import { test } from "node:test";
import assert from "node:assert/strict";
import coordinatorFactory from "../backend/services/ticketEmailDeliveryCoordinator.js";

function coordinator({ postgres = false, onWake = () => {} } = {}) {
  return coordinatorFactory.createTicketEmailDeliveryCoordinator({
    enrichTicket: (_db, ticket) => ticket,
    googleWalletSaveUrl: async () => "",
    ticketDownloadPdf: async () => Buffer.from("synthetic"),
    logEvent: () => {},
    emailService: { sendTicketDelivery: async () => true },
    appFrontendUrl: () => "https://cinema.invalid",
    readDb: async () => ({ orders: [] }),
    orderTickets: () => [],
    shouldDeliverBoxOfficeTicketsByEmail: () => true,
    structuredCloneSafe: structuredClone,
    deliverBoxOfficeTicketsBySelectedMethod: async () => ({ status: "delivered" }),
    withCriticalMutation: async (fn) => fn(),
    writeDb: async () => {},
    deferUntilPostgresCommit: () => false,
    postgresEnabled: () => postgres,
    getTicketEmailWorker: () => ({ wake: onWake }),
    outsidePostgresTransaction: (fn) => fn(),
    requestContext: { run: (_state, fn) => fn() },
    mutationContext: { run: (_state, fn) => fn() }
  });
}

test("PostgreSQL queue wakes the existing worker and does not deliver on import", () => {
  let wakes = 0;
  const delivery = coordinator({ postgres: true, onWake: () => { wakes += 1; } });
  assert.equal(wakes, 0);
  assert.equal(delivery.queueTicketEmailDelivery(" order "), true);
  assert.equal(wakes, 1);
});

test("JSON compatibility queue coalesces duplicate order IDs", async () => {
  const delivery = coordinator();
  assert.equal(delivery.queueTicketEmailDelivery("order"), true);
  assert.equal(delivery.queueTicketEmailDelivery("order"), false);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivery.queueTicketEmailDelivery("order"), true);
});
