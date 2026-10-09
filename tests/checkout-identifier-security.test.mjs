import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import service from "../backend/services/checkoutIdentifier.js";

test("IDs de pagamento mantem valores antigos validos e rejeitam codigo em atributos", () => {
  assert.equal(service.checkoutIdentifier("sessao-1-1728512345000-aabbcc"), "sessao-1-1728512345000-aabbcc");
  for (const value of ["x');globalThis.injected=true;//", "a b", "<img>", "a&b", {}, "x".repeat(161)]) {
    assert.throws(() => service.checkoutIdentifier(value), { code: "INVALID_CHECKOUT_IDENTIFIER" });
  }
});

test("lista administrativa nao coloca IDs de pedidos em handlers inline", () => {
  const source = readFileSync(fileURLToPath(new URL("../backend/public/admin.js", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /onclick="[^"]*(?:openOrderView|openConcessionOrderDetail|toggleOrderMenu)\('\$\{escapeHtml\((?:order\.id|payment\.orderId)\)\}/);
  assert.match(source, /data-admin-order-id="\$\{escapeHtml\(order\.id\)\}"/);
});
