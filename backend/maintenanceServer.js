const http = require("node:http");
const { readReleaseInfo } = require("./services/releaseInfoService");

function createMaintenanceServer({ instance, expectedSha, releaseInfo = readReleaseInfo }) {
  if (instance !== "cinecruzeiro" || !/^[a-f0-9]{40}$/.test(expectedSha || "")) {
    throw new Error("MAINTENANCE_CONFIGURATION_INVALID");
  }
  const release = releaseInfo();
  if (release.commit !== expectedSha) throw new Error("MAINTENANCE_RELEASE_MISMATCH");
  const unavailable = { error: { code: "SERVICE_UNAVAILABLE", message: "Servico temporariamente indisponivel." } };
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": "60",
    "X-Content-Type-Options": "nosniff"
  };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/api/health/maintenance" && (req.method === "GET" || req.method === "HEAD")) {
      const body = JSON.stringify({ mode: "quiescent", instance, commit: expectedSha });
      res.writeHead(200, { ...headers, "Content-Length": Buffer.byteLength(body) });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(503, headers);
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(unavailable));
  });
  server.on("upgrade", (_request, socket) => {
    socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 60\r\n\r\n");
  });
  return server;
}

module.exports = { createMaintenanceServer };
