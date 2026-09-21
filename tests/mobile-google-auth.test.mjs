import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.join(dirname, "../backend/server.js"), "utf8");

test("login Google mobile usa retorno fixo, curto e de uso único", () => {
  assert.match(serverSource, /new URL\("cinelumix:\/\/google-auth"\)/);
  assert.match(serverSource, /Date\.now\(\) \+ 2 \* 60 \* 1000/);
  assert.match(serverSource, /mobileAuthHandoffs\.delete\(handoff\.nonce\)/);
  assert.match(serverSource, /type: "mobile_google_handoff"/);
  assert.doesNotMatch(serverSource, /mobileCallback/);
});

test("troca mobile recria cookie HTTP-only antes de voltar à conta", () => {
  assert.match(serverSource, /pathname === "\/api\/auth\/mobile\/google\/consume"/);
  assert.match(serverSource, /"Set-Cookie": customerCookie\(customerSessionValue\(user\)\)/);
  assert.match(serverSource, /"Referrer-Policy": "no-referrer"/);
});
