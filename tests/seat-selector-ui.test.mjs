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

test("checkout não expõe estados internos de reconexão para quem compra", () => {
  assert.doesNotMatch(checkoutSource, /Reconectando à reserva de poltronas/);
  assert.doesNotMatch(checkoutSource, /Conectando à reserva de poltronas/);
});
