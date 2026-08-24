const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");

function databaseUrl() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para rodar migrations PostgreSQL.");
  }
  return value;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl() });
  const migrationsDir = path.join(__dirname, "..", "backend", "db", "migrations");
  await client.connect();
  try {
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
