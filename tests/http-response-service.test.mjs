import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createHttpResponseService } = require("../backend/services/httpResponseService.js");

function response() {
  return {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; }
  };
}

test("HTTP responses preserve CORS, request ID, errors, 204 and post-commit deferral", () => {
  const context = new AsyncLocalStorage();
  let pending;
  let committed = false;
  const { sendJson, sendNoContent } = createHttpResponseService({
    publicApiError: (_error, requestId) => ({ code: "INTERNAL_ERROR", message: "Falha interna", requestId }),
    requestContext: context,
    postgresEnabled: () => true,
    deferUntilPostgresCommit: (callback) => { if (committed) return false; pending = callback; return true; },
    isCommercialCatalogRequest: (req) => req?.commercial === true,
    responseCorsOrigin: () => "https://cinema.example.test",
    securityHeaders: () => ({ "X-Frame-Options": "SAMEORIGIN" })
  });
  context.run({ req: { commitResponseAfterMutation: true }, requestId: "synthetic-request" }, () => {
    const deferred = response();
    sendJson(deferred, 201, { id: "synthetic" }, { "X-Contract": "kept" });
    assert.equal(deferred.status, undefined);
    committed = true;
    pending();
    assert.equal(deferred.status, 201);
    assert.equal(deferred.headers["X-Request-Id"], "synthetic-request");
    assert.equal(deferred.headers["Access-Control-Allow-Origin"], "https://cinema.example.test");
    assert.equal(deferred.headers["X-Contract"], "kept");
    assert.deepEqual(JSON.parse(deferred.body), { id: "synthetic" });

    const clientError = response();
    sendJson(clientError, 404, { error: "Ausente" });
    assert.deepEqual(JSON.parse(clientError.body), { error: { code: "REQUEST_ERROR", message: "Ausente" } });

    const serverError = response();
    sendJson(serverError, 500, { error: "internal detail" });
    assert.deepEqual(JSON.parse(serverError.body), {
      error: { code: "INTERNAL_ERROR", message: "Falha interna", requestId: "synthetic-request" }
    });

    const empty = response();
    sendNoContent(empty);
    assert.equal(empty.status, 204);
    assert.equal(empty.headers["Access-Control-Allow-Origin"], "https://cinema.example.test");
    assert.equal(empty.headers["X-Request-Id"], "synthetic-request");
  });

  context.run({ req: { commercial: true }, requestId: "catalog" }, () => {
    const catalog = response();
    sendJson(catalog, 200, { ok: true });
    assert.equal(catalog.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(catalog.headers["Access-Control-Allow-Credentials"], undefined);
  });
});
