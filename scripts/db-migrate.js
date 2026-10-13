const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");
const { runGuardedMigration, PILOT_IDENTITY_DIGEST, digest } = require("./guarded-migration");

function databaseUrl() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para rodar migrations PostgreSQL.");
  }
  return value;
}

async function main() {
  const guarded = process.argv[2] === "--guarded-pilot" && process.argv.length === 4;
  if (process.argv.length > 2 && !guarded) throw new Error("Argumentos de migration invalidos.");
  const client = new Client({ connectionString: databaseUrl() });
  const migrationsDir = path.join(__dirname, "..", "backend", "db", "migrations");
  if (guarded) {
    const authorization = JSON.parse(await fs.readFile(process.argv[3], "utf8"));
    const release = JSON.parse(await fs.readFile(path.join(__dirname, "..", "release-info.json"), "utf8"));
    await client.connect();
    try {
      const applied = await runGuardedMigration({ client, connectionString: databaseUrl(), authorization,
        migrationsDir, releaseSha: release.commit });
      console.log(`MIGRATION_GUARDED_OK count=${applied.length}`);
    } finally { await client.end(); }
    return;
  }
  await client.connect();
  try {
    const identity = (await client.query("SELECT current_database() AS database_name, current_user AS role_name")).rows[0];
    if (process.env.CINE_INSTANCE_SLUG === "cinecruzeiro"
      || digest(identity.database_name).slice(0, 12) === PILOT_IDENTITY_DIGEST
      || digest(identity.role_name).slice(0, 12) === PILOT_IDENTITY_DIGEST) {
      throw new Error("MIGRATION_GUARD_REQUIRED: Cine Cruzeiro exige --guarded-pilot e autorizacao especifica.");
    }
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
      if (applied.rowCount) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
