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
