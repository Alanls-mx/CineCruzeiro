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

test("iniciar outra compra sinaliza a entrada e descarta a confirmação antiga", () => {
  assert.match(selector, /href=\{`\/checkout\/\$\{session\.id\}\?novaCompra=1`\}/);
  assert.match(home, /href=\{`\/checkout\/\$\{firstSession\.id\}\?novaCompra=1`\}/);
  assert.match(checkoutRoute, /startNew=\{query\.novaCompra === "1"\}/);
  assert.match(checkout, /if \(startNew && step === "ingressos"\) \{[\s\S]*?clearCheckoutDraft\(sessionId\);[\s\S]*?router\.replace\(`\/checkout\/\$\{sessionId\}`/);
});
