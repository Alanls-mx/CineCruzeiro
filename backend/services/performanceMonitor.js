const os = require("node:os");
const fs = require("node:fs/promises");
const { monitorEventLoopDelay } = require("node:perf_hooks");

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]);
}

function isExternalDependencyPath(pathname = "") {
  return /^\/api\/(?:payments|webhooks|subscriptions\/checkout|checkout\/orders\/)/.test(String(pathname));
}

function routeKey(request) {
  return `${request.method || "GET"} ${String(request.path || "").replace(/\/[0-9a-f-]{16,}/gi, "/:id")}`;
}

function createPerformanceMonitor({ diskPath, onAlert = () => {}, intervalMs = 15000 }) {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let requests = [];
  let previous = os.cpus();
  let current = null;
  let busy = false;
  let closed = false;
  let activeAlerts = new Set();
  const history = [];

  function record(durationMs, statusCode, metadata = {}) {
    requests.push({
      at: Date.now(),
      durationMs: Math.max(0, Number(durationMs) || 0),
      statusCode: Number(statusCode) || 0,
      method: String(metadata.method || "GET").toUpperCase(),
      path: String(metadata.path || ""),
      externalDependency: metadata.externalDependency === true || isExternalDependencyPath(metadata.path)
    });
    if (requests.length > 25000) requests.splice(0, requests.length - 25000);
  }

  async function sample() {
    if (busy || closed) return;
    busy = true;
    try {
      const now = Date.now();
      const cpus = os.cpus();
      let idle = 0;
      let total = 0;
      cpus.forEach((cpu, index) => {
        const before = previous[index]?.times;
        if (!before) return;
        idle += cpu.times.idle - before.idle;
        for (const key of Object.keys(cpu.times)) total += cpu.times[key] - before[key];
      });
      previous = cpus;
      const stat = await fs.statfs(diskPath).catch(() => null);
      requests = requests.filter((request) => request.at > now - 300000);
      const totalMemory = os.totalmem();
      const memoryUsed = totalMemory - os.freemem();
      const internalRequests = requests.filter((request) => !request.externalDependency);
      const externalRequests = requests.filter((request) => request.externalDependency);
      const routeGroups = new Map();
      requests.forEach((request) => {
        const key = routeKey(request);
        const group = routeGroups.get(key) || { route: key, durations: [], requestCount: 0, errors5xx: 0, externalDependency: request.externalDependency };
        group.durations.push(request.durationMs);
        group.requestCount += 1;
        if (request.statusCode >= 500) group.errors5xx += 1;
        routeGroups.set(key, group);
      });
      const slowestRoutes = [...routeGroups.values()]
        .map((group) => ({
          route: group.route,
          requestCount: group.requestCount,
          requestP95Ms: percentile(group.durations, 0.95),
          errors5xx: group.errors5xx,
          externalDependency: group.externalDependency
        }))
        .sort((a, b) => b.requestP95Ms - a.requestP95Ms)
        .slice(0, 5);
      const sampleData = {
        sampledAt: new Date(now).toISOString(),
        scope: "host",
        vcores: cpus.length,
        cpuPercent: total > 0 ? Math.round(100 * (1 - idle / total)) : null,
        memoryTotal: totalMemory,
        memoryUsed,
        processRss: process.memoryUsage().rss,
        diskTotal: stat ? stat.blocks * stat.bsize : null,
        diskAvailable: stat ? stat.bavail * stat.bsize : null,
        eventLoopP95Ms: Math.round(delay.percentile(95) / 1e6),
        requestCount: requests.length,
        sampleCapped: requests.length >= 25000,
        requestP95Ms: percentile(internalRequests.map((request) => request.durationMs), 0.95),
        overallRequestP95Ms: percentile(requests.map((request) => request.durationMs), 0.95),
        externalRequestP95Ms: percentile(externalRequests.map((request) => request.durationMs), 0.95),
        internalRequestCount: internalRequests.length,
        externalRequestCount: externalRequests.length,
        slowestRoutes,
        errors5xx: requests.filter((r) => r.statusCode >= 500).length,
        uptimeSeconds: Math.floor(process.uptime())
      };
      delay.reset();
      const alerts = [];
      if (sampleData.cpuPercent >= 90) alerts.push({ code: "cpu", message: "CPU do servidor acima de 90%." });
      if (memoryUsed / totalMemory >= 0.9) alerts.push({ code: "memory", message: "Memoria do host acima de 90% (inclui cache do sistema)." });
      if (stat && sampleData.diskAvailable / sampleData.diskTotal < 0.1) alerts.push({ code: "disk", message: "Menos de 10% de disco disponivel." });
      if (internalRequests.length >= 10 && sampleData.requestP95Ms > 2000) alerts.push({ code: "latency", message: "A latência interna HTTP p95 está acima de 2 segundos." });
      if (externalRequests.length >= 5 && sampleData.externalRequestP95Ms > 5000) alerts.push({ code: "external_latency", message: "Integrações externas estão respondendo acima de 5 segundos no p95." });
      if (sampleData.eventLoopP95Ms > 200) alerts.push({ code: "event_loop", message: "Backend com atraso no processamento acima de 200 ms." });
      if (sampleData.errors5xx >= 5 && sampleData.errors5xx / requests.length >= 0.05) alerts.push({ code: "http_errors", message: "Falhas internas em pelo menos 5% das requisicoes." });
      for (const alert of alerts) {
        if (!activeAlerts.has(alert.code)) onAlert("warn", "performance.anomaly", { ...alert, metrics: sampleData });
      }
      for (const code of activeAlerts) {
        if (!alerts.some((alert) => alert.code === code)) onAlert("info", "performance.recovered", { code });
      }
      activeAlerts = new Set(alerts.map((alert) => alert.code));
      current = { ...sampleData, alerts };
      history.push(current);
      if (history.length > 240) history.shift();
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(() => { void sample().catch(() => {}); }, intervalMs);
  timer.unref();
  void sample().catch(() => {});
  return {
    record,
    snapshot: () => ({ current, history: [...history], intervalMs, requestWindowSeconds: 300 }),
    close: () => { closed = true; clearInterval(timer); delay.disable(); }
  };
}

module.exports = { createPerformanceMonitor, percentile };
