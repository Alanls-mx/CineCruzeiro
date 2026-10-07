const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");

const run = promisify(execFile);
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const markerPath = path.join(root, "backend", "data", ".studio-postgres-imported");
const container = "cine-cruzeiro-studio-postgres";
const port = 55432;

async function command(file, args, env = process.env) {
  return run(file, args, { cwd: root, env, timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
}

async function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await command("docker", ["exec", container, "pg_isready", "-U", "cine_studio", "-d", "cine_cruzeiro_local"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("O PostgreSQL local não ficou pronto. Consulte docker logs cine-cruzeiro-studio-postgres.");
}

async function main() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) throw new Error("Esta sessão já possui uma URL PostgreSQL. Não vou alterar outro banco.");
  if (process.env.DATA_STORE === "json") throw new Error("Remova DATA_STORE=json da sessão antes de ativar o PostgreSQL local.");
  await command("docker", ["info", "--format", "{{.ServerVersion}}"]).catch(() => { throw new Error("Inicie o Docker Desktop antes de executar este comando."); });

  let contents = await fs.readFile(envPath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const saved = contents.match(/^DATABASE_URL=(.+)$/m);
  if (saved && !saved[1].includes(`127.0.0.1:${port}/cine_cruzeiro_local`)) throw new Error(".env.local já aponta para outro banco. Preserve essa configuração e use um ambiente separado.");

  const inspected = await command("docker", ["inspect", "--format", "{{.State.Running}}", container]).catch(() => null);
  let databaseUrl = saved?.[1]?.trim();
  if (inspected && !databaseUrl) throw new Error("O container local já existe, mas .env.local não contém sua URL. Não vou substituir as credenciais.");
  if (!inspected) {
    if (databaseUrl) throw new Error(".env.local já aponta para este banco, mas o container não existe. Recupere o container/volume antes de gerar outras credenciais.");
    const volume = await command("docker", ["volume", "inspect", "cine-cruzeiro-studio-pgdata"]).catch(() => null);
    if (volume) throw new Error("O volume PostgreSQL local já existe sem o container. Recupere-o antes de criar outro banco.");
    if (await portInUse()) throw new Error(`A porta local ${port} já está ocupada. Não vou alterar outro serviço.`);
    const password = randomBytes(30).toString("base64url");
    databaseUrl = `postgresql://cine_studio:${password}@127.0.0.1:${port}/cine_cruzeiro_local`;
    await command("docker", ["run", "-d", "--name", container, "--restart", "unless-stopped", "-p", `127.0.0.1:${port}:5432`, "-v", "cine-cruzeiro-studio-pgdata:/var/lib/postgresql/data", "-e", "POSTGRES_USER=cine_studio", "-e", "POSTGRES_DB=cine_cruzeiro_local", "-e", "POSTGRES_PASSWORD", "postgres:16-alpine"], { ...process.env, POSTGRES_PASSWORD: password });
    contents += `${contents && !contents.endsWith("\n") ? "\n" : ""}DATABASE_URL=${databaseUrl}\n`;
    await fs.writeFile(envPath, contents, { mode: 0o600 });
  } else if (inspected.stdout.trim() !== "true") {
    await command("docker", ["start", container]);
  }

  await waitForDatabase();
  const env = { ...process.env, DATABASE_URL: databaseUrl, DATA_STORE: "postgres" };
  const migrated = await command(process.execPath, ["scripts/db-migrate.js"], env);
  process.stdout.write(migrated.stdout);
  const imported = await fs.access(markerPath).then(() => true, () => false);
  if (!imported) {
    await fs.access(path.join(root, "backend", "data", "db.json"));
    const result = await command(process.execPath, ["scripts/db-import-json.js"], env);
    process.stdout.write(result.stdout);
    await fs.writeFile(markerPath, `${new Date().toISOString()}\n`);
  }
  console.log("PostgreSQL local pronto. Reinicie o backend para carregar .env.local e abra /admin.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
