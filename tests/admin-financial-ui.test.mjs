import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const adminSource = fs.readFileSync(path.join(dirname, "../backend/public/admin.js"), "utf8");
const functionSource = adminSource.match(/function financialStatusEvent\(record = \{\}, related = \{\}\) \{[\s\S]*?\n\}/)?.[0];

test("histórico financeiro tolera pagamento relacionado nulo", () => {
  assert.ok(functionSource, "financialStatusEvent não foi encontrado no painel");
  const context = {};
  vm.runInNewContext(`${functionSource}; result = financialStatusEvent({ status: "paid", approvedAt: "2026-09-15T12:00:00.000Z" }, null);`, context);
  assert.equal(context.result.label, "Aprovado em");
  assert.equal(context.result.at, "2026-09-15T12:00:00.000Z");
});

test("histórico financeiro aceita registro principal nulo", () => {
  assert.ok(functionSource, "financialStatusEvent não foi encontrado no painel");
  const context = {};
  vm.runInNewContext(`${functionSource}; result = financialStatusEvent(null, { status: "refunded", refundedAt: "2026-09-15T13:00:00.000Z" });`, context);
  assert.equal(context.result.label, "Reembolsado em");
  assert.equal(context.result.at, "2026-09-15T13:00:00.000Z");
});
