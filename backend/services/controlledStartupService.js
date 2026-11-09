// Opt-in gate for a supervised release cut. The default runtime keeps its
// existing route and worker behavior; a controlled restart fails closed.
const STAGES = ["preflight", "auth", "callbacks", "checkout", "workers", "full"];
const HEALTH_PATHS = new Set(["/api/health", "/api/health/live", "/api/health/ready"]);
const AUTH_PATHS = new Set([
  "/api/auth/login", "/api/auth/me", "/api/auth/logout",
  "/api/admin/login", "/api/admin/login/2fa", "/api/admin/me", "/api/admin/logout"
]);
const CALLBACK_PATHS = new Set(["/api/webhooks/mercado-pago", "/api/webhooks/pag-bank"]);
const CHECKOUT_POST_PATHS = new Set([
  "/api/payments/pix", "/api/payments/card", "/api/checkout/club-credit"
]);
const CHECKOUT_READ_PREFIXES = [
  "/api/movies", "/api/sessions", "/api/seats", "/api/commercial/catalog",
  "/api/checkout/", "/api/orders", "/api/content"
];

function createControlledStartupService({ enabled = false, onTransition = () => {} } = {}) {
  let stageIndex = enabled ? 0 : STAGES.length - 1;

  function stage() { return STAGES[stageIndex]; }

  function allowsRequest(pathname, method) {
    if (!enabled || stage() === "full") return true;
    if ((method === "GET" || method === "OPTIONS") && HEALTH_PATHS.has(pathname)) return true;
    if (stageIndex >= 1 && AUTH_PATHS.has(pathname)) return true;
    if (stageIndex >= 2 && (method === "POST" || method === "OPTIONS") && CALLBACK_PATHS.has(pathname)) return true;
    if (stageIndex >= 3) {
      if ((method === "POST" || method === "OPTIONS") && CHECKOUT_POST_PATHS.has(pathname)) return true;
      if ((method === "GET" || method === "HEAD" || method === "OPTIONS")
        && CHECKOUT_READ_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) return true;
    }
    return false;
  }

  function advance() {
    if (!enabled || stageIndex === STAGES.length - 1) return stage();
    const previous = stage();
    stageIndex += 1;
    onTransition(previous, stage());
    return stage();
  }

  return {
    enabled, stage, advance, allowsRequest,
    readinessAllowed: () => stageIndex === STAGES.length - 1,
    allowsSocket: () => stageIndex >= 3,
    allowsWorkers: () => stageIndex >= 4,
    allowsIntegrations: () => stageIndex >= 5
  };
}

module.exports = { createControlledStartupService, STAGES };
