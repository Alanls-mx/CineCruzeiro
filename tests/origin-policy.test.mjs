import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { allowedOrigins, canonicalOrigin } = require("../backend/services/originPolicyService.js");

test("normaliza URLs com caminho para a origem enviada pelo navegador", () => {
  assert.equal(canonicalOrigin("https://lumixengine.com/projects/cinemax-piraju"), "https://lumixengine.com");
  assert.deepEqual(allowedOrigins("https://lumixengine.com/projects/cinemax-piraju,https://www.lumixengine.com"), [
    "https://lumixengine.com",
    "https://www.lumixengine.com"
  ]);
});

test("preserva origens locais sem caminho", () => {
  assert.deepEqual(allowedOrigins("http://localhost:3000,http://127.0.0.1:3000"), [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
});

test("ignora coringas, esquemas invalidos e credenciais em CORS", () => {
  assert.equal(canonicalOrigin("*"), "");
  assert.equal(canonicalOrigin("javascript:alert(1)"), "");
  assert.equal(canonicalOrigin("https://user:pass@evil.example"), "");
  assert.deepEqual(allowedOrigins("*,javascript:alert(1),https://lumixengine.com/projects/cinecruzeiro"), [
    "https://lumixengine.com"
  ]);
});
