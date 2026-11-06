function createInfrastructureRoutes({
  checkPostgresReadiness, latestSchemaMigration, isProduction, postgresEnabled, sendJson, serveDesktopUpdate
}) {
  async function handleHealthRoute({ res, pathname, method }) {
    if (pathname === "/api/health/live" && method === "GET") {
      sendJson(res, 200, { status: "alive" }, { "Cache-Control": "no-store" });
      return true;
    }

    if (["/api/health", "/api/health/ready"].includes(pathname) && method === "GET") {
      const readiness = postgresEnabled()
        ? await checkPostgresReadiness(latestSchemaMigration)
        : { ready: !isProduction(), database: !isProduction(), migrations: !isProduction() };
      sendJson(res, readiness.ready ? 200 : 503, {
        status: readiness.ready ? (pathname === "/api/health" ? "ok" : "ready") : "not_ready"
      }, { "Cache-Control": "no-store" });
      return true;
    }
    return false;
  }

  async function handleDesktopUpdateRoute({ res, pathname, method }) {
    if (pathname.startsWith("/api/desktop/update/") && method === "GET") {
      await serveDesktopUpdate(res, pathname);
      return true;
    }
    return false;
  }

  return { handleHealthRoute, handleDesktopUpdateRoute };
}

module.exports = { createInfrastructureRoutes };
