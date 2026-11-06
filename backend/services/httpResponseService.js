function createHttpResponseService({ publicApiError, requestContext, postgresEnabled, deferUntilPostgresCommit, isCommercialCatalogRequest, responseCorsOrigin, securityHeaders }) {
  function normalizeApiPayload(data, status, requestId = "") {
    if (!data || typeof data !== "object" || !("error" in data)) return data;
    if (typeof data.error === "string") {
      if (status >= 500) {
        const safe = publicApiError(Object.assign(new Error(data.error), { statusCode: status }), requestId);
        return { ...data, error: { code: safe.code, message: safe.message, requestId: safe.requestId } };
      }
      return {
        ...data,
        error: {
          code: "REQUEST_ERROR",
          message: data.error
        }
      };
    }
    return data;
  }

  function sendJson(res, status, data, extraHeaders = {}) {
    const store = requestContext.getStore();
    const req = store?.req;
    if (req?.commitResponseAfterMutation && postgresEnabled()
      && deferUntilPostgresCommit(() => sendJson(res, status, data, extraHeaders))) return;
    const catalogRequest = isCommercialCatalogRequest(req);
    const payload = normalizeApiPayload(data, status, store?.requestId || "");
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(status, {
      ...securityHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      ...(catalogRequest ? {} : { "Access-Control-Allow-Origin": responseCorsOrigin(req), "Access-Control-Allow-Credentials": "true" }),
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key, Authorization",
      "X-Request-Id": store?.requestId || "",
      ...extraHeaders
    });
    res.end(body);
  }

  function sendNoContent(res, extraHeaders = {}) {
    const store = requestContext.getStore();
    const req = store?.req;
    const catalogRequest = isCommercialCatalogRequest(req);
    res.writeHead(204, {
      ...securityHeaders(),
      ...(catalogRequest ? {} : { "Access-Control-Allow-Origin": responseCorsOrigin(req), "Access-Control-Allow-Credentials": "true" }),
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key, Authorization",
      "X-Request-Id": store?.requestId || "",
      ...extraHeaders
    });
    res.end();
  }
  return { sendJson, sendNoContent };
}

module.exports = { createHttpResponseService };
