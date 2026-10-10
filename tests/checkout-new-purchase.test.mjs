import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selector = fs.readFileSync(path.join(root, "src/components/MovieSessionSelector.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const checkout = fs.readFileSync(path.join(root, "src/components/CheckoutPage.tsx"), "utf8");
const checkoutRoute = fs.readFileSync(path.join(root, "src/app/checkout/[sessionId]/page.tsx"), "utf8");

test("reentrada na mesma sessão preserva seleção e pagamento em andamento", () => {
  assert.match(selector, /href=\{`\/checkout\/\$\{session\.id\}\?novaCompra=1`\}/);
  assert.match(home, /href=\{`\/checkout\/\$\{firstSession\.id\}\?novaCompra=1`\}/);
  assert.match(checkoutRoute, /startNew=\{query\.novaCompra === "1"\}/);
  assert.match(checkout, /const canResumeCurrentSession = existing\?\.sessionId === sessionId\s*&& Boolean\(existing\.selectedSeatIds\?\.length\)/);
  assert.match(checkout, /if \(!canResumeCurrentSession\) \{[\s\S]*?clearCheckoutDraft\(sessionId\);/);
  assert.match(checkout, /if \(!canResumeCurrentSession\) \{[\s\S]*?return;\s*\}\s*router\.replace\(`\/checkout\/\$\{sessionId\}`/);
});
