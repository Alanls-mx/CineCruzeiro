const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PILOT_INSTANCE = "cinecruzeiro";
const PILOT_IDENTITY_DIGEST = "e599e94bf4eb";
const PILOT_PENDING = ["051_ticket_email_jobs.sql", "052_point_payment_methods.sql"];
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;

function fail() {
  throw new Error("MIGRATION_TARGET_REJECTED: identidade, release ou esquema nao autorizado.");
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertPilotAuthorization(authorization, expectedDigest = PILOT_IDENTITY_DIGEST) {
  if (authorization?.instance !== PILOT_INSTANCE
    || digest(String(authorization.database || "")).slice(0, 12) !== expectedDigest
    || digest(String(authorization.role || "")).slice(0, 12) !== expectedDigest
    || authorization.expectedRelease !== "ea7c5df24cf44d64516d00d81585cb2b0f7efe09"
    || !SHA.test(authorization.candidateSha || "")
    || !Array.isArray(authorization.pending)
    || JSON.stringify(authorization.pending) !== JSON.stringify(PILOT_PENDING)) fail();
}

function assertAuthorizationShape(authorization, connectionString, releaseSha) {
  let url;
  try { url = new URL(connectionString); } catch { fail(); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.search || url.hash
    || authorization?.instance !== PILOT_INSTANCE || !authorization.database || !authorization.role
    || !authorization.origin?.host || !authorization.origin?.serverAddress
    || !Number.isInteger(authorization.origin?.port)
    || authorization.origin.port < 1 || authorization.origin.port > 65535
    || !Number.isInteger(authorization.origin?.serverPort)
    || authorization.origin.serverPort < 1 || authorization.origin.serverPort > 65535
    || !SHA.test(authorization.candidateSha || "") || releaseSha !== authorization.candidateSha
    || !Array.isArray(authorization.applied) || !Array.isArray(authorization.pending)
    || !authorization.pending.length || !authorization.hashes
    || decodeURIComponent(url.pathname.slice(1)) !== authorization.database
    || decodeURIComponent(url.username) !== authorization.role
    || url.hostname !== authorization.origin.host
    || Number(url.port || 5432) !== authorization.origin.port
    || !Array.isArray(authorization.applied) || new Set(authorization.applied).size !== authorization.applied.length
    || new Set(authorization.pending).size !== authorization.pending.length) fail();
  return url;
}

async function readMigrationSet(migrationsDir, authorization) {
  const actual = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const expected = [...authorization.applied, ...authorization.pending];
  if (JSON.stringify(actual) !== JSON.stringify(expected)
    || JSON.stringify(Object.keys(authorization.hashes).sort()) !== JSON.stringify(actual)) fail();
  const contents = new Map();
  for (const file of actual) {
    if (!/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(file) || !DIGEST.test(authorization.hashes[file] || "")) fail();
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    if (digest(sql) !== authorization.hashes[file]) fail();
    contents.set(file, sql);
  }
  return contents;
}

async function assertConnectedTarget(client, authorization) {
  const result = await client.query(`SELECT current_database() AS database_name, current_user AS role_name,
    session_user AS session_role, current_schema() AS schema_name,
    inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
    pg_get_userbyid(d.datdba) AS database_owner,
    has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
    r.rolsuper AS is_superuser
    FROM pg_database d JOIN pg_roles r ON r.rolname = current_user
    WHERE d.datname = current_database()`);
  const row = result.rows[0];
  if (result.rowCount !== 1 || row.database_name !== authorization.database
    || row.role_name !== authorization.role || row.session_role !== authorization.role
    || row.schema_name !== "public" || row.database_owner !== authorization.role
    || row.server_address !== authorization.origin.serverAddress
    || Number(row.server_port) !== authorization.origin.serverPort
    || !row.can_create || row.is_superuser) fail();

  const owners = await client.query(`SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`, [["schema_migrations", "orders", "payments"]]);
  if (owners.rowCount !== 3 || owners.rows.some((item) => item.owner !== authorization.role)) fail();
  const applied = await client.query("SELECT filename FROM public.schema_migrations ORDER BY filename");
  if (JSON.stringify(applied.rows.map((row) => row.filename)) !== JSON.stringify(authorization.applied)) fail();
  const state = await client.query(`SELECT to_regclass('public.ticket_email_jobs') IS NULL AS jobs_absent,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_method_check' AND convalidated
      AND pg_get_constraintdef(oid) NOT LIKE '%point_debit%') AS old_payment_check,
    NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.orders'::regclass
      AND tgname = 'trg_queue_paid_ticket_email' AND NOT tgisinternal) AS trigger_absent`);
  if (!state.rows[0]?.jobs_absent || !state.rows[0]?.old_payment_check || !state.rows[0]?.trigger_absent) fail();
}

async function runGuardedMigration({ client, connectionString, authorization, migrationsDir, releaseSha, pilot = false }) {
  if (pilot) assertPilotAuthorization(authorization);
  assertAuthorizationShape(authorization, connectionString, releaseSha);
  const contents = await readMigrationSet(migrationsDir, authorization);
  await client.query("BEGIN");
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cine_guarded_migration'))");
    await assertConnectedTarget(client, authorization);
    for (const file of authorization.pending) {
      await client.query(contents.get(file));
      await client.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [file]);
    }
    commitAttempted = true;
    await client.query("COMMIT");
    return authorization.pending;
  } catch (error) {
    if (commitAttempted) throw new Error("MIGRATION_COMMIT_UNKNOWN: nao repetir; inspecione o historico por canal autorizado.");
    await client.query("ROLLBACK").catch(() => {});
    if (error.message.startsWith("MIGRATION_TARGET_REJECTED")) throw error;
    throw new Error("MIGRATION_ABORTED: transacao revertida; consulte logs PostgreSQL restritos.");
  }
}

module.exports = { runGuardedMigration, assertPilotAuthorization, assertAuthorizationShape, PILOT_IDENTITY_DIGEST, digest };
