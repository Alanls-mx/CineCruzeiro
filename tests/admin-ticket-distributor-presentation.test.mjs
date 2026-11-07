import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminTicketDistributorPresentation } = require("../backend/services/adminTicketDistributorPresentation.js");

const presenter = createAdminTicketDistributorPresentation({
  todayIsoDate: () => "2026-11-06",
  normalizeTicketDistributorRules: () => ({ distributorPercent: 40, courtesyPercent: 0, clubTicketFee: 0 }),
  calculateTicketDistributorReport: (entries, rules) => ({ entries, rules, totals: { quantity: entries.length } }),
  brazilianDate: (date) => date || "-",
  brl: (amount) => `R$ ${Number(amount || 0).toFixed(2)}`,
  buildPdf: (pages) => Buffer.from(pages.join("|")),
  pdfRect: () => "[rect]",
  pdfWriteText: (text) => String(text),
  pdfLine: () => "[line]"
});

test("empty report keeps date window and does not recognize a sale", () => {
  const report = presenter.ticketDistributorReport({ settings: {}, orders: [], movies: [] });
  assert.deepEqual(report.period, { start: "2026-11-06", end: "2026-11-06" });
  assert.deepEqual(report.entries, []);
  assert.equal(report.totals.quantity, 0);
});

test("PDF projection keeps cinema identity and financial disclaimer", () => {
  const pdf = presenter.ticketDistributorReportPdf({ period: { start: "2026-11-01", end: "2026-11-06" }, rows: [], details: [], totals: {}, rules: {} }, "Cinema de Teste");
  assert.equal(Buffer.isBuffer(pdf), true);
  assert.match(pdf.toString(), /Cinema de Teste/);
  assert.match(pdf.toString(), /somente ingressos reconhecidos financeiramente/);
  assert.doesNotMatch(pdf.toString(), /private@example.test/);
});

test("labels remain stable for paid, club and courtesy tickets", () => {
  assert.equal(presenter.ticketDistributorCategoryLabel("paid"), "Ingresso pago");
  assert.equal(presenter.ticketDistributorCategoryLabel("club"), "Clube de assinatura");
  assert.equal(presenter.ticketDistributorCategoryLabel("courtesy"), "Indicação / Cortesia");
});
