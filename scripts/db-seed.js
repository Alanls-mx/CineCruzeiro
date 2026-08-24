const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

function databaseUrl() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para rodar seed PostgreSQL.");
  }
  return value;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

async function main() {
  const adminName = process.env.SEED_ADMIN_NAME || "Admin Cine Cruzeiro";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@cinecruzeiro.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "cine-cruzeiro-dev-admin";
  const client = new Client({ connectionString: databaseUrl() });
  const seedFile = path.join(__dirname, "..", "backend", "db", "seed.sql");
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.seed_admin_name', $1, true)", [adminName]);
    await client.query("SELECT set_config('app.seed_admin_email', $1, true)", [adminEmail]);
    await client.query("SELECT set_config('app.seed_admin_password_hash', $1, true)", [hashPassword(adminPassword)]);
    await client.query(await fs.readFile(seedFile, "utf8"));
    await client.query("COMMIT");
    console.log(`seed aplicado. Admin dev: ${adminEmail}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
