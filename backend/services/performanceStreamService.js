function createPerformanceStreamService({ releaseInfo, sendJson, securityHeaders, getSnapshot }) {
  const performanceStreamClients = new Set();
  function performanceStreamPayload(snapshot, includeHistory = false) {
    return JSON.stringify({
      current: snapshot.current,
      ...(includeHistory ? { history: snapshot.history } : {}),
      intervalMs: snapshot.intervalMs,
      requestWindowSeconds: snapshot.requestWindowSeconds,
      release: releaseInfo
    });
  }
  function broadcastPerformanceSnapshot(metrics) {
    if (!performanceStreamClients.size) return;
    const frame = `data: ${performanceStreamPayload({ current: metrics, intervalMs: 1000, requestWindowSeconds: 300 })}\n\n`;
    for (const response of performanceStreamClients) {
      if (response.destroyed || response.writableEnded) {
        performanceStreamClients.delete(response);
        continue;
      }
      if (response.writableLength < 256 * 1024) response.write(frame);
    }
  }
  function openPerformanceStream(res) {
    if (performanceStreamClients.size >= 12) {
      sendJson(res, 429, { error: { code: "PERFORMANCE_STREAM_LIMIT", message: "Limite de conexões de telemetria ao vivo atingido." } });
      return;
    }
    res.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write("retry: 2000\n\n");
    performanceStreamClients.add(res);
    res.write(`data: ${performanceStreamPayload(getSnapshot(), true)}\n\n`);
    res.once("close", () => {
      performanceStreamClients.delete(res);
    });
  }
  return { openPerformanceStream, broadcastPerformanceSnapshot };
}

module.exports = { createPerformanceStreamService };
