import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createTicketQrReader } = require("../backend/public/admin-modules/ticket-qr-reader.js");

test("closing scanner stops the camera and all timers", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { classList: { toggle: () => {} }, textContent: "", className: "", srcObject: {}, disabled: false });
    return elements.get(id);
  };
  let stops = 0;
  const state = { qrStream: { getTracks: () => [{ stop: () => { stops++; } }] }, qrTorchTrack: {},
    qrTorchOn: true, qrScanDeadline: 123, qrScanTimer: setInterval(() => {}, 60000),
    qrCloseTimer: setTimeout(() => {}, 60000), qrCountdownTimer: setInterval(() => {}, 60000),
    qrAutoRestartTimer: setTimeout(() => {}, 60000) };
  try {
    const reader = createTicketQrReader({ state, $, window: {}, document: {}, navigator: {}, location: { hostname: "localhost" },
      QR_SCAN_DURATION_MS: 30000, BarcodeDetector: undefined, escapeHtml: String, showToast: () => {},
      validateTicketByCode: () => {}, renderTicketValidationResult: () => {}
    });
    reader.stopQrReader();
    assert.equal(stops, 1);
    assert.equal(state.qrStream, null);
    assert.equal(state.qrScanTimer, null);
    assert.equal(state.qrCloseTimer, null);
    assert.equal(state.qrCountdownTimer, null);
    assert.equal(state.qrTorchTrack, null);
    assert.equal($("qrVideo").srcObject, null);
  } finally {
    clearInterval(state.qrScanTimer);
    clearTimeout(state.qrCloseTimer);
    clearInterval(state.qrCountdownTimer);
    clearTimeout(state.qrAutoRestartTimer);
  }
});
