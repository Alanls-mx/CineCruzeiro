import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createTicketValidationController } = require("../backend/public/admin-modules/ticket-validation-controller.js");

test("ticket inspection requires a separate server confirmation before entry", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", className: "", innerHTML: "", textContent: "",
      querySelector: () => ({ addEventListener: () => {} }), querySelectorAll: () => [] });
    return elements.get(id);
  };
  const state = { validationMode: "entry", validationSessionLock: false, qrValidationLocked: false,
    qrPendingEntryCode: "", qrPendingConcessionCode: "" };
  const requests = [];
  let reloads = 0;
  const controller = createTicketValidationController({ state, $, api: async (path, options) => {
    assert.equal(path, "/api/tickets/validate");
    const body = JSON.parse(options.body);
    requests.push(body);
    return body.action === "inspect"
      ? { result: "ticket_pending_confirmation", confirmationRequired: true, ticket: { code: "ticket-qa" } }
      : { result: "validated", confirmationRequired: false, ticket: { code: "ticket-qa" } };
  }, document: { querySelector: () => null }, navigator: { onLine: true, vibrate: () => {} },
  escapeHtml: String, showToast: () => {}, loadContent: async () => { reloads++; },
  setQrReaderActive: () => {}, startQrReader: () => {}
  });
  await controller.validateTicketByCode("ticket-qa");
  assert.equal(state.qrPendingEntryCode, "ticket-qa");
  assert.equal(requests[0].action, "inspect");
  assert.equal(reloads, 0);
  await controller.confirmTicketEntry("ticket-qa");
  assert.equal(requests[1].action, "confirm");
  assert.equal(state.qrPendingEntryCode, "");
  assert.equal(reloads, 1);
});
