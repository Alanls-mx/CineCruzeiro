import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createPerformanceStreamService } = require("../backend/services/performanceStreamService.js");

function response() {
  const res = new EventEmitter();
  res.frames = [];
  res.writableLength = 0;
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
  res.write = (frame) => { res.frames.push(frame); };
  return res;
}

test("performance SSE keeps initial frame, live broadcast, cap and disconnect cleanup", () => {
  const releaseInfo = { sha: "synthetic" };
  const stream = createPerformanceStreamService({
    releaseInfo,
    sendJson: (res, status, body) => { res.status = status; res.body = body; },
    securityHeaders: () => ({ "X-Frame-Options": "SAMEORIGIN" }),
    getSnapshot: () => ({ current: { requests: 1 }, history: [{ requests: 0 }], intervalMs: 1000, requestWindowSeconds: 300 })
  });
  const clients = Array.from({ length: 12 }, response);
  for (const client of clients) stream.openPerformanceStream(client);
  const first = clients[0];
  assert.equal(first.status, 200);
  assert.equal(first.headers["Content-Type"], "text/event-stream; charset=utf-8");
  assert.equal(first.headers["Cache-Control"], "no-cache, no-transform");
  assert.equal(first.frames[0], "retry: 2000\n\n");
  assert.deepEqual(JSON.parse(first.frames[1].slice(6)), {
    current: { requests: 1 }, history: [{ requests: 0 }], intervalMs: 1000, requestWindowSeconds: 300, release: releaseInfo
  });

  const limited = response();
  stream.openPerformanceStream(limited);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, "PERFORMANCE_STREAM_LIMIT");

  first.writableLength = 256 * 1024;
  stream.broadcastPerformanceSnapshot({ requests: 2 });
  assert.equal(first.frames.length, 2);
  assert.equal(clients[1].frames.length, 3);
  assert.deepEqual(JSON.parse(clients[1].frames[2].slice(6)), {
    current: { requests: 2 }, intervalMs: 1000, requestWindowSeconds: 300, release: releaseInfo
  });

  first.emit("close");
  stream.openPerformanceStream(limited);
  assert.equal(limited.status, 200);
  clients[1].destroyed = true;
  stream.broadcastPerformanceSnapshot({ requests: 3 });
  assert.equal(clients[1].frames.length, 3);
});
