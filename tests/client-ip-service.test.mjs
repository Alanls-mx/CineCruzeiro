import test from "node:test";
import assert from "node:assert/strict";
import ipService from "../backend/services/clientIpService.js";

function request(remoteAddress, headers = {}) {
  return { socket: { remoteAddress }, headers };
}

test("IP remoto direto prevalece sobre cabecalhos controlados pelo cliente", () => {
  assert.equal(ipService.clientIp(request("198.51.100.10", {
    "x-forwarded-for": "203.0.113.77", "x-real-ip": "203.0.113.78"
  })), "198.51.100.10");
});

test("proxy local usa somente o ultimo salto valido", () => {
  assert.equal(ipService.clientIp(request("127.0.0.1", {
    "x-forwarded-for": "1.1.1.1, 203.0.113.77"
  })), "203.0.113.77");
  assert.equal(ipService.clientIp(request("::1", {
    "x-forwarded-for": "2001:db8::1"
  })), "2001:db8::1");
});

test("cabecalho malformado nao cria identidade arbitraria para limite de taxa", () => {
  assert.equal(ipService.clientIp(request("::ffff:127.0.0.1", {
    "x-forwarded-for": "203.0.113.77, forged-key", "x-real-ip": "198.51.100.30"
  })), "198.51.100.30");
  assert.equal(ipService.clientIp(request("127.0.0.1", {
    "x-forwarded-for": "forged-key", "x-real-ip": "also-forged"
  })), "127.0.0.1");
});
