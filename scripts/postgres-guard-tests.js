const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { assertDisposableTestDatabase, assertDisposableTestServer } = require("./test-postgres-safety");
const { runGuardedMigration, assertPilotAuthorization } = require("./guarded-migration");

const migrationsDir = path.join(__dirname, "..", "backend", "db", "migrations");
const OLD_RELEASE = "ea7c5df24cf44d64516d00d81585cb2b0f7efe09";
const CANDIDATE = "a".repeat(40);
const pending = ["051_ticket_email_jobs.sql", "052_point_payment_methods.sql"];
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function fixture(client, applied) {
  await client.query("CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  for (const file of applied) {
    await client.query("BEGIN");
    try {
      await client.query(await fs.readFile(path.join(migrationsDir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function state(client) {
  const result = await client.query(`SELECT count(*)::int AS migrations,
    to_regclass('public.ticket_email_jobs') IS NOT NULL AS jobs,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'public.payments'::regclass AND conname = 'payments_method_check') AS payment_check
    FROM schema_migrations`);
  return result.rows[0];
}

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  await assertDisposableTestDatabase(url);
  await assertDisposableTestServer();
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const applied = files.filter((file) => file <= "050_room_cleanup_minutes.sql");
  assert.deepEqual(files.slice(applied.length), pending);
  const hashes = Object.fromEntries(await Promise.all(files.map(async (file) =>
    [file, digest(await fs.readFile(path.join(migrationsDir, file), "utf8"))])));
  const currentUrl = new URL(url);
  const targetName = decodeURIComponent(currentUrl.pathname.slice(1));
  const alternateName = `cinecruzeiro_test_${crypto.randomBytes(8).toString("hex")}`;
  const alternateToken = crypto.randomBytes(16).toString("hex");
  const alternateUrl = new URL(url);
  alternateUrl.pathname = `/${alternateName}`;
  const admin = new Client({ connectionString: process.env.TEST_POSTGRES_ADMIN_URL });
  const target = new Client({ connectionString: url });
  let alternate;
  let created = false;
  await admin.connect();
  await target.connect();
  try {
    await fixture(target, applied);
    const endpoint = (await target.query("SELECT inet_server_addr()::text AS address, inet_server_port() AS port")).rows[0];
    const authorization = {
      instance: "cinecruzeiro", database: targetName, role: "cine_test_admin",
      expectedRelease: OLD_RELEASE, candidateSha: CANDIDATE,
      origin: { host: currentUrl.hostname, port: Number(currentUrl.port || 5432),
        serverAddress: endpoint.address, serverPort: endpoint.port },
      applied, pending, hashes
    };
    const run = (client, targetUrl, value = authorization, candidate = CANDIDATE) => runGuardedMigration({
      client, connectionString: targetUrl, authorization: value, migrationsDir, releaseSha: candidate, syntheticTest: true
    });
    const before = await state(target);
    async function reject(client, targetUrl, value, candidate = CANDIDATE) {
      await assert.rejects(run(client, targetUrl, value, candidate), /MIGRATION_TARGET_REJECTED|MIGRATION_ABORTED/);
      assert.deepEqual(await state(target), before);
      if (alternate) assert.deepEqual(await state(alternate), before);
    }

    await admin.query(`CREATE DATABASE "${alternateName}"`);
    created = true;
    alternate = new Client({ connectionString: alternateUrl.toString() });
    await alternate.connect();
    await alternate.query("CREATE TABLE cine_test_database_marker (id integer PRIMARY KEY CHECK (id = 1), token text NOT NULL)");
    await alternate.query("INSERT INTO cine_test_database_marker (id, token) VALUES (1, $1)", [alternateToken]);
    await fixture(alternate, applied);
    assert.deepEqual(await state(alternate), before);

    await reject(alternate, url, authorization); // Runtime connection changed after URL preflight.
    await assert.rejects(async () => assertPilotAuthorization({ ...authorization, database: alternateName },
      digest(targetName).slice(0, 12)), /MIGRATION_TARGET_REJECTED/);
    assert.deepEqual(await state(alternate), before);
    await reject(target, url, { ...authorization, role: "unexpected_role" });
    await reject(target, url, { ...authorization, database: `${targetName}x` });
    await reject(target, url, { ...authorization, instance: "other-cinema" });
    await reject(target, url, { ...authorization, origin: { ...authorization.origin, port: 1 } });
    await reject(target, url, { ...authorization, applied: applied.slice(0, -1) });
    await reject(target, url, { ...authorization, pending: ["052_point_payment_methods.sql"] });
    await reject(target, url, { ...authorization, hashes: { ...hashes, [pending[0]]: "0".repeat(64) } });
    await reject(target, url, authorization, "b".repeat(40));
    await reject(target, url, { ...authorization, candidateSha: "b".repeat(40) });
    await reject(target, url, { ...authorization, role: "cine_test_admin", database: alternateName });
    await reject(target, url, { ...authorization, applied: [...applied, "unexpected.sql"] });
    const legacy = spawnSync(process.execPath, [path.join(__dirname, "db-migrate.js")], {
      encoding: "utf8", env: { ...process.env, CINE_INSTANCE_SLUG: "cinecruzeiro", DATABASE_URL: url, POSTGRES_URL: "" }
    });
    assert.notEqual(legacy.status, 0);
    assert.match(legacy.stderr, /MIGRATION_GUARD_REQUIRED/);
    assert.deepEqual(await state(target), before);
    await assert.rejects(async () => assertPilotAuthorization(authorization), /MIGRATION_TARGET_REJECTED/);
    await assert.rejects(async () => assertPilotAuthorization({ ...authorization, database: alternateName },
      digest(targetName).slice(0, 12)), /MIGRATION_TARGET_REJECTED/);

    const blocker = new Client({ connectionString: url });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("LOCK TABLE payments IN ACCESS SHARE MODE");
      await assert.rejects(run(target, url), /MIGRATION_ABORTED/);
    } finally {
      await blocker.query("ROLLBACK");
      await blocker.end();
    }
    assert.deepEqual(await state(target), before, "051 tambem deve reverter se 052 perde o lock");
    const competitor = new Client({ connectionString: url });
    await competitor.connect();
    let races;
    try {
      races = await Promise.allSettled([run(target, url), run(competitor, url)]);
    } finally { await competitor.end(); }
    assert.equal(races.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(races.filter((item) => item.status === "rejected").length, 1);
    assert.deepEqual(races.find((item) => item.status === "fulfilled").value, pending);
    const after = await state(target);
    assert.equal(after.migrations, files.length);
    assert.equal(after.jobs, true);
    assert.match(after.payment_check, /point_debit/);
    assert.deepEqual(await state(alternate), before);
    await assert.rejects(run(target, url), /MIGRATION_TARGET_REJECTED/);
    assert.deepEqual(await state(target), after);
    console.log("PG_GUARDED_MIGRATION_OK alternate_unchanged=true lock_rollback=true concurrent_winner=1");
  } finally {
    await target.end();
    if (created && alternate) {
      const marker = (await alternate.query("SELECT token FROM cine_test_database_marker WHERE id = 1")).rows[0]?.token;
      if (marker !== alternateToken) throw new Error("Marcador do segundo banco divergente; limpeza recusada.");
    }
    if (alternate) await alternate.end();
    if (created) await admin.query(`DROP DATABASE "${alternateName}"`);
    await admin.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
