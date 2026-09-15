import test from "node:test";
import assert from "node:assert/strict";
import reportService from "../backend/services/ticketDistributorReportService.js";

test("calculates paid, club and courtesy ticket rules without concessions", () => {
  const report = reportService.calculateTicketDistributorReport([
    { type: "Inteira", category: "paid", paidAmount: 20, standardFullPrice: 20 },
    { type: "Meia-entrada", category: "paid", paidAmount: 10, standardFullPrice: 20 },
    { type: "Clube", category: "club", paidAmount: 0, standardFullPrice: 20 },
    { type: "Indicação", category: "courtesy", paidAmount: 0, standardFullPrice: 20 }
  ], { distributorPercent: 50, courtesyPercent: 50, clubTicketFee: 10 });

  assert.deepEqual(report.totals, {
    quantity: 4,
    grossRevenue: 30,
    distributorCost: 35,
    cinemaNet: 5,
    retentionPercent: 16.67
  });
  assert.equal(report.rows.find((row) => row.category === "club").cinemaNet, 0);
  assert.equal(report.rows.find((row) => row.category === "courtesy").cinemaNet, -10);
});

test("supports configurable distributor percentages", () => {
  const report = reportService.calculateTicketDistributorReport([
    { type: "Inteira", category: "paid", paidAmount: 40, standardFullPrice: 40 }
  ], { distributorPercent: 60, courtesyPercent: 55, clubTicketFee: 12 });
  assert.equal(report.rows[0].distributorCost, 24);
  assert.equal(report.rows[0].cinemaNet, 16);
});

test("provides an auditable calculation line for each exported ticket", () => {
  const report = reportService.calculateTicketDistributorReport([
    { ticketCode: "CC-23456789", type: "Inteira", category: "paid", paidAmount: 30, standardFullPrice: 30 },
    { ticketCode: "CC-34567890", type: "Clube", category: "club", paidAmount: 0, standardFullPrice: 30 },
    { ticketCode: "CC-45678901", type: "Cortesia", category: "courtesy", paidAmount: 0, standardFullPrice: 30 }
  ], { distributorPercent: 55, courtesyPercent: 50, clubTicketFee: 11 }, { includeDetails: true });

  assert.equal(report.details.length, 3);
  assert.deepEqual(report.details.map((item) => item.ticketCode), ["CC-23456789", "CC-34567890", "CC-45678901"]);
  assert.deepEqual(report.details.map((item) => item.distributorCost), [16.5, 11, 15]);
  assert.deepEqual(report.details.map((item) => item.ruleLabel), [
    "55% do valor pago",
    "Taxa fixa de R$ 11,00",
    "50% da inteira padrão"
  ]);
  assert.deepEqual(report.details.map((item) => item.cinemaNet), [13.5, 0, -15]);
});
