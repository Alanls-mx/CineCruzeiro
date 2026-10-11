const crypto = require("node:crypto");
const { allowedOrigins } = require("./originPolicyService");

function isCommercialCatalogRequest(req) {
  return req?.url?.split("?", 1)[0] === "/api/commercial/catalog";
}

function commercialCatalogToken(req) {
  const authorization = String(req?.headers?.authorization || "").trim();
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    return String(bearer || req.headers?.["x-commercial-catalog-token"] || url.searchParams.get("token") || "").trim();
  } catch {
    return String(bearer || req.headers?.["x-commercial-catalog-token"] || "").trim();
  }
}

function catalogTokensMatch(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  return expectedBuffer.length > 0
    && expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function commercialCatalogCorsHeaders(req, config = {}) {
  const requestOrigin = String(req?.headers?.origin || "").replace(/\/+$/, "");
  const configuredOrigins = String(config.allowedOrigins || "").trim();
  const permittedOrigins = configuredOrigins ? allowedOrigins(configuredOrigins) : [];
  if (!requestOrigin || !permittedOrigins.includes(requestOrigin)) return {};
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Credentials": "false",
    "Vary": "Origin"
  };
}

module.exports = {
  isCommercialCatalogRequest,
  commercialCatalogToken,
  catalogTokensMatch,
  commercialCatalogCorsHeaders
};
