function createAdminLogsHandler({ BUSINESS_LOG_EVENTS, businessLogVisible, getPerformanceMonitor, listSystemLogsFromPostgres, logEvent, openPerformanceStream, postgresDiagnostics, postgresEnabled, pruneSystemLogsFromPostgres, readBody, releaseInfo, sendJson }) {
  return async function handleAdminLogsRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/logs/performance" && method === "GET") {
    sendJson(res, 200, { ...getPerformanceMonitor().snapshot(), database: postgresEnabled() ? postgresDiagnostics() : null, release: releaseInfo });
    return true;
  }

  if (pathname === "/api/admin/logs/performance/stream" && method === "GET") {
    openPerformanceStream(res);
    return true;
  }

  if (pathname === "/api/admin/logs" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      level: String(url.searchParams.get("level") || "").trim(),
      category: String(url.searchParams.get("category") || "").trim(),
      search: String(url.searchParams.get("search") || "").trim().slice(0, 160),
      from: String(url.searchParams.get("from") || "").trim(),
      to: String(url.searchParams.get("to") || "").trim(),
      view: url.searchParams.get("view") === "technical" ? "technical" : "business",
      businessEvents: [...BUSINESS_LOG_EVENTS],
      page: Math.max(1, Number(url.searchParams.get("page") || 1)),
      pageSize: Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 50)))
    };
    if (postgresEnabled()) {
      sendJson(res, 200, await listSystemLogsFromPostgres(filters));
      return true;
    }
    const filtered = (db.auditLogs || []).map((item) => ({
      id: item.id,
      level: "info",
      category: "audit",
      event: item.action || "admin.action",
      message: "",
      requestId: "",
      actorUserId: item.userId || item.updatedBy || "",
      actorEmail: item.userEmail || item.updatedByEmail || "",
      method: String(item.action || "").split(" ")[0] || "",
      path: String(item.action || "").split(" ")[1] || "",
      statusCode: null,
      durationMs: null,
      ip: item.ip || "",
      userAgent: "",
      metadata: item,
      createdAt: item.createdAt || item.at || ""
    })).filter((item) => (filters.view === "technical" || businessLogVisible(item)))
      .filter((item) => (!filters.level || item.level === filters.level))
      .filter((item) => (!filters.category || item.category === filters.category || String(item.event || "").startsWith(`${filters.category}.`) || String(item.event || "").startsWith(`${filters.category}_`)))
      .filter((item) => (!filters.search || JSON.stringify(item).toLowerCase().includes(filters.search.toLowerCase())));
    const start = (filters.page - 1) * filters.pageSize;
    sendJson(res, 200, {
      logs: filtered.slice(start, start + filters.pageSize),
      total: filtered.length,
      page: filters.page,
      pageSize: filters.pageSize,
      pages: Math.max(1, Math.ceil(filtered.length / filters.pageSize)),
      last24Hours: { info: filtered.length }
    });
    return true;
  }

  if (pathname === "/api/admin/logs" && method === "DELETE") {
    const body = await readBody(req);
    const retentionDays = Math.min(3650, Math.max(1, Number(body.retentionDays || 90)));
    const technicalRetentionDays = Math.min(3650, Math.max(1, Number(body.technicalRetentionDays || 3)));
    const result = postgresEnabled()
      ? await pruneSystemLogsFromPostgres({
          retentionDays,
          technicalRetentionDays,
          businessEvents: [...BUSINESS_LOG_EVENTS]
        })
      : { total: 0, deletedTechnical: 0, deletedGeneral: 0 };
    const deleted = result.total || 0;
    logEvent("info", "logs.retention_applied", {
      retentionDays,
      technicalRetentionDays,
      deleted,
      deletedTechnical: result.deletedTechnical || 0,
      deletedGeneral: result.deletedGeneral || 0,
      actorUserId: req.adminUser?.id || ""
    });
    sendJson(res, 200, {
      deleted,
      deletedTechnical: result.deletedTechnical || 0,
      deletedGeneral: result.deletedGeneral || 0,
      retentionDays,
      technicalRetentionDays,
      message: `${deleted} registro(s) antigo(s) removido(s) (${result.deletedTechnical || 0} de diagnóstico técnico, ${result.deletedGeneral || 0} da visão do cinema).`
    });
    return true;
  }

    return false;
  };
}

module.exports = { createAdminLogsHandler };
