const { Client } = require("pg");

function startCacheInvalidation(config, invalidate) {
  let client, retry, closed = false, connected = false;
  function reconnect(candidate) {
    if (closed || retry || candidate !== client) return;
    connected = false;
    invalidate();
    retry = setTimeout(() => { retry = null; void connect(); }, 3000);
    retry.unref();
  }
  async function connect() {
    if (closed) return;
    const candidate = new Client({ ...config, application_name: `${config.application_name}-cache`.slice(0, 63) });
    client = candidate;
    candidate.on("notification", (event) => { if (event.channel === "cine_data_changed") invalidate(); });
    candidate.on("error", () => { void candidate.end().catch(() => {}); reconnect(candidate); });
    candidate.on("end", () => reconnect(candidate));
    try {
      await candidate.connect();
      await candidate.query("LISTEN cine_data_changed");
      if (closed) { await candidate.end(); return; }
      connected = true;
      invalidate();
    } catch {
      await candidate.end().catch(() => {});
      reconnect(candidate);
    }
  }
  void connect();
  return {
    connected: () => connected,
    async close() { closed = true; connected = false; clearTimeout(retry); if (client) await client.end().catch(() => {}); }
  };
}
module.exports = { startCacheInvalidation };
