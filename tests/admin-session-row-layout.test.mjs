import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminSource = fs.readFileSync(path.join(root, "backend/public/admin.js"), "utf8");
const premiumStyles = fs.readFileSync(path.join(root, "backend/public/admin-premium.css"), "utf8");

test("linha de sessão separa horário e status dos detalhes", () => {
  assert.match(adminSource, /class="session-row-primary">\s*<time>\$\{escapeHtml\(session\.time \|\| "--:--"\)\}<\/time>\s*<span>\$\{escapeHtml\(globalSessionStatusLabel\(session\.status\)\)\}<\/span>/);
  assert.match(adminSource, /<span title="\$\{escapeHtml\(ticketTypeSummary\)\}">/);
});

test("colunas de sessão podem encolher sem invadir a coluna de horário", () => {
  assert.match(premiumStyles, /grid-template-columns:\s*minmax\(96px,[^)]*\) minmax\(0, 1\.2fr\) minmax\(0, 1fr\) auto/);
  assert.match(premiumStyles, /\.session-row-primary\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(premiumStyles, /@media \(max-width: 760px\)\s*\{\s*\.session-row \{ grid-template-columns: 1fr;/);
});
