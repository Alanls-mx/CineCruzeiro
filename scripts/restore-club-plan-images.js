const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function loadBackendProcessEnvironment() {
  const pid = String(execFileSync("pm2", ["pid", "cinecruzeiro-backend"], { encoding: "utf8" })).trim();
  if (!/^\d+$/.test(pid)) throw new Error("PID do backend indisponivel.");
  const entries = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  entries.forEach((entry) => {
    const separator = entry.indexOf("=");
    if (separator > 0) process.env[entry.slice(0, separator)] = entry.slice(separator + 1);
  });
}

function planFilePrefix(id) {
  return String(id || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function run() {
  loadBackendProcessEnvironment();
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Conexao PostgreSQL indisponivel no processo do backend.");

  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false }
  });
  try {
    const uploadsRoot = path.resolve(__dirname, "../backend/public/uploads/club-plans");
    const files = fs.existsSync(uploadsRoot) ? fs.readdirSync(uploadsRoot) : [];
    const { rows } = await pool.query("SELECT id, name, image_url FROM subscription_plans ORDER BY name");
    const restored = [];

    for (const plan of rows) {
      if (plan.image_url) continue;
      const prefix = `${planFilePrefix(plan.id)}-`;
      const latest = files
        .filter((name) => name.toLowerCase().startsWith(prefix))
        .map((name) => ({ name, mtime: fs.statSync(path.join(uploadsRoot, name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0];
      if (!latest) continue;

      const imageUrl = `/uploads/club-plans/${latest.name}`;
      const result = await pool.query(
        "UPDATE subscription_plans SET image_url = $1, updated_at = now() WHERE id = $2 AND COALESCE(image_url, '') = ''",
        [imageUrl, plan.id]
      );
      if (result.rowCount) restored.push({ id: plan.id, imageUrl });
    }

    console.log(JSON.stringify({ restored }));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
