import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const checkoutSource = fs.readFileSync(path.join(dirname, "../src/components/CheckoutPage.tsx"), "utf8");
const adminSource = fs.readFileSync(path.join(dirname, "../backend/public/admin.js"), "utf8");
const adminStyles = fs.readFileSync(path.join(dirname, "../backend/public/admin.css"), "utf8");

test("checkout não exibe numeração redundante abaixo das poltronas", () => {
  assert.doesNotMatch(checkoutSource, /seatColumnGuides|Numeração das fileiras/);
});

test("venda manual não exibe numeração redundante abaixo das poltronas", () => {
  assert.doesNotMatch(adminSource, /manual-seat-column-footer|manual-seat-column-labels|Numeração das fileiras/);
  assert.doesNotMatch(adminStyles, /\.manual-seat-column-footer|\.manual-seat-column-labels/);
});

test("os dois seletores repetem a letra da fileira nos lados esquerdo e direito", () => {
  assert.match(checkoutSource, /aria-hidden="true">\{row\.label\}<\/span>/);
  assert.match(adminSource, /manual-seat-row-label" aria-hidden="true">\$\{escapeHtml\(row\.label\)\}<\/span>/);
  assert.doesNotMatch(adminSource, /manual-seat-row-spacer/);
});

test("checkout mantém a seleção disponível quando o WebSocket demora a conectar", () => {
  const realtimeHook = fs.readFileSync(path.join(dirname, "../src/hooks/useSeatRealtime.ts"), "utf8");
  const serverSource = fs.readFileSync(path.join(dirname, "../backend/server.js"), "utf8");
  assert.match(realtimeHook, /api\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/seats\/hold/);
  assert.match(realtimeHook, /sendFallbackRequest\(type, seatId\)/);
  assert.match(serverSource, /seats\\\/hold/);
  assert.match(serverSource, /connectionId: "http-fallback"/);
});
