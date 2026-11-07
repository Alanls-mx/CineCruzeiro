const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");

function createSnapshotPersistenceRuntime({
  dataFile, isProduction, postgresEnabled, readDbFromPostgres, rememberSnapshot,
  normalizeDb, appendAuditLog, writeDbToPostgres, withPostgresMutationLock
}) {
  const mutationContext = new AsyncLocalStorage();
  let jsonMutationQueue = Promise.resolve();

  async function readDb(options = {}) {
    if (isProduction() && !postgresEnabled()) {
      throw Object.assign(new Error("PostgreSQL deve estar configurado em producao."), {
        code: "POSTGRES_REQUIRED_IN_PRODUCTION",
        statusCode: 500
      });
    }
    const db = postgresEnabled()
      ? await readDbFromPostgres({ includeAuditLogs: false, ...options, trackChanges: false })
      : JSON.parse(await fs.readFile(dataFile, "utf8"));
    const normalized = normalizeDb(db);
    if (postgresEnabled() && options.trackChanges !== false) rememberSnapshot(normalized);
    return normalized;
  }

  async function writeDb(db) {
    appendAuditLog(db);
    if (postgresEnabled()) {
      await writeDbToPostgres(normalizeDb(db), { normalize: normalizeDb });
      return;
    }
    const tempFile = `${dataFile}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      await fs.writeFile(tempFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
      for (let attempt = 0; ; attempt += 1) {
        try {
          await fs.rename(tempFile, dataFile);
          break;
        } catch (error) {
          if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes(error.code) || attempt >= 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
    } finally {
      await fs.unlink(tempFile).catch(() => null);
    }
  }

  async function withCriticalMutation(callback) {
    if (postgresEnabled()) return withPostgresMutationLock(callback);
    if (mutationContext.getStore()?.active) return callback();
    const previous = jsonMutationQueue;
    let release;
    jsonMutationQueue = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await mutationContext.run({ active: true }, callback);
    } finally {
      release();
    }
  }

  return { readDb, writeDb, withCriticalMutation, mutationContext };
}

module.exports = { createSnapshotPersistenceRuntime };
