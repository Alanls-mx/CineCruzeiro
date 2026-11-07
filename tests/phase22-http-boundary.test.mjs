import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import bodyService from "../backend/services/httpRequestBodyService.js";

const { readBody } = bodyService.createHttpRequestBodyService(32);

function request(parts, declaredLength = "") {
  const req = Readable.from(parts.map((part) => Buffer.from(part)));
  req.headers = declaredLength ? { "content-length": declaredLength } : {};
  return req;
}

test("body HTTP preserva JSON, buffer bruto e requisições concorrentes", async () => {
  const first = request(['{"a":', '1}']);
  const second = request(['{"b":2}']);
  const [a, b] = await Promise.all([readBody(first), readBody(second)]);
  assert.equal(a.a, 1);
  assert.equal(b.b, 2);
  assert.equal(first.rawBody, '{"a":1}');
  assert.equal(second.rawBody, '{"b":2}');
  assert.equal(first.rawBodyBuffer.toString(), '{"a":1}');
  const raw = request(["not-json"]);
  assert.equal((await readBody(raw, { rawOnly: true })).toString(), "not-json");
  assert.deepEqual(JSON.parse(JSON.stringify(await readBody(request([])))), {});
});

test("body HTTP mantém erros 400 e 413 antes de parsear ou aceitar tamanho falso", async () => {
  await assert.rejects(readBody(request(["{" ])), (error) => error.statusCode === 400 && error.code === "INVALID_JSON");
  await assert.rejects(readBody(request(["{}"], "33")), (error) => error.statusCode === 413 && error.code === "PAYLOAD_TOO_LARGE");
  await assert.rejects(readBody(request(["x".repeat(20), "x".repeat(13)])), (error) => error.statusCode === 413 && error.code === "PAYLOAD_TOO_LARGE");
});
