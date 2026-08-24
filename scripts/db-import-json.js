const fs = require("fs/promises");
const path = require("path");

process.env.DATA_STORE = "postgres";

const { writeDbToPostgres } = require("../backend/db/postgresStore");

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para importar o JSON para PostgreSQL.");
  }

  const dbPath = path.join(__dirname, "..", "backend", "data", "db.json");
  const db = JSON.parse(await fs.readFile(dbPath, "utf8"));
  await writeDbToPostgres(db);
  console.log("backend/data/db.json importado para PostgreSQL.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
