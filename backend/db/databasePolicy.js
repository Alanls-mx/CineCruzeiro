function integer(value, fallback, min, max) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function poolConfiguration(env = process.env) {
  return {
    connectionString: env.DATABASE_URL || env.POSTGRES_URL || "",
    application_name: String(env.DATABASE_APPLICATION_NAME || "cinecruzeiro-backend").slice(0, 63),
    max: integer(env.POSTGRES_POOL_MAX, 6, 2, 30),
    connectionTimeoutMillis: integer(env.POSTGRES_CONNECT_TIMEOUT_MS, 3000, 500, 15000),
    idleTimeoutMillis: integer(env.POSTGRES_IDLE_TIMEOUT_MS, 30000, 1000, 120000),
    statement_timeout: integer(env.POSTGRES_STATEMENT_TIMEOUT_MS, 15000, 1000, 120000),
    lock_timeout: integer(env.POSTGRES_LOCK_TIMEOUT_MS, 3000, 250, 15000),
    idle_in_transaction_session_timeout: integer(env.POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS, 60000, 5000, 180000),
    allowExitOnIdle: Boolean(env.TEST_DATABASE_URL),
    keepAlive: true
  };
}
module.exports = { poolConfiguration };
