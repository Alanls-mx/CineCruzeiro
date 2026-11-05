// Local-only Docker bootstrap for the guarded PostgreSQL test harness.
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { assertDisposableTestServer } = require("./test-postgres-safety");

const use18 = process.argv[2] === "--pg18";
const image = use18 ? "postgres:18-alpine" : "postgres:16-alpine";
const dataPath = use18 ? "/var/lib/postgresql" : "/var/lib/postgresql/data";
const allowedTargets = new Set(["smoke", "concurrency", "repositories", "guard", "upgrade"]);
const targets = process.argv.slice(use18 ? 3 : 2);
if (!targets.length || targets.some((target) => !allowedTargets.has(target))) {
  throw new Error("Escolha um ou mais: smoke, concurrency, repositories, guard, upgrade; use --pg18 para upgrade.");
}
if (targets.includes("upgrade") && !use18) throw new Error("O ensaio upgrade exige --pg18.");
for (const name of ["DATABASE_URL", "POSTGRES_URL", "TEST_DATABASE_URL", "TEST_POSTGRES_ADMIN_URL", "CINE_TEST_SERVER_TOKEN"]) {
  if (process.env[name]) throw new Error(`Remova ${name} do ambiente antes de criar um contêiner descartável.`);
}

function docker(args, input) {
  const result = spawnSync("docker", args, { encoding: "utf8", input, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Docker falhou: ${result.error?.message || result.stderr?.trim() || args[0]}`);
  return result.stdout.trim();
}

async function main() {
  docker(["image", "inspect", image, "--format", "{{.Id}}"]); // No implicit pull or remote image.
  const nonce = crypto.randomBytes(8).toString("hex");
  const marker = crypto.randomBytes(16).toString("hex");
  const password = crypto.randomBytes(24).toString("hex");
  const name = `cine-mod-test-${nonce}`;
  const label = `cine.modularization.disposable=${marker}`;
  let id = "";
  function cleanup() {
    if (!id) return;
    const inspected = spawnSync("docker", ["inspect", id], { encoding: "utf8", windowsHide: true });
    if (inspected.status !== 0) return; // --rm may already have removed it.
    const container = JSON.parse(inspected.stdout)[0];
    if (container?.Config?.Labels?.["cine.modularization.disposable"] !== marker || container?.Name !== `/${name}`) {
      throw new Error("Identidade do contêiner divergente; não será removido.");
    }
    docker(["rm", "-f", id]);
    id = "";
  }
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { cleanup(); process.exit(1); });
  try {
    id = docker(["run", "--rm", "-d", "--name", name, "--label", label,
      "--tmpfs", `${dataPath}:rw,size=512m`,
      "-e", `POSTGRES_PASSWORD=${password}`, "-p", "127.0.0.1::5432", image]);
    const container = JSON.parse(docker(["inspect", id]))[0];
    if (container?.Config?.Image !== image || container?.Config?.Labels?.["cine.modularization.disposable"] !== marker
        || !container?.HostConfig?.Tmpfs?.[dataPath]
        || container?.Mounts?.some((mount) => mount.Type !== "tmpfs")
        || !container?.NetworkSettings?.Ports?.["5432/tcp"]?.some((entry) => entry.HostIp === "127.0.0.1")) {
      throw new Error("Contêiner não corresponde ao PostgreSQL local e sem volume esperado.");
    }
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const probe = spawnSync("docker", ["exec", id, "pg_isready", "-U", "postgres", "-d", "postgres"], { windowsHide: true });
      if (probe.status === 0) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error("PostgreSQL descartável não ficou pronto.");
    // The image briefly opens a bootstrap postmaster before restarting the
    // final server. Do not issue setup SQL against that transient socket.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    let finalReady = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const probe = spawnSync("docker", ["exec", id, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "SELECT 1"],
        { encoding: "utf8", windowsHide: true });
      if (probe.status === 0 && probe.stdout.trim() === "1") { finalReady = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!finalReady) throw new Error("PostgreSQL final descartável não ficou pronto.");
    const sql = `CREATE ROLE cine_test_admin LOGIN CREATEDB PASSWORD '${password}';\n`
      + `CREATE TABLE cine_test_server_marker (id integer PRIMARY KEY CHECK (id = 1), token text NOT NULL);\n`
      + `INSERT INTO cine_test_server_marker (id, token) VALUES (1, '${marker}');\n`
      + "GRANT SELECT ON cine_test_server_marker TO cine_test_admin;\n";
    docker(["exec", "-i", id, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], sql);
    const binding = container.NetworkSettings.Ports["5432/tcp"].find((entry) => entry.HostIp === "127.0.0.1");
    const port = Number(binding.HostPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Porta local descartável inválida.");
    const adminUrl = `postgresql://cine_test_admin:${password}@127.0.0.1:${port}/postgres`;
    const env = { ...process.env, NODE_ENV: "test", TEST_POSTGRES_ADMIN_URL: adminUrl, CINE_TEST_SERVER_TOKEN: marker,
      DATABASE_URL: "", POSTGRES_URL: "", TEST_DATABASE_URL: "" };
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try { await assertDisposableTestServer(adminUrl, marker); }
    finally { if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv; }
    for (const target of targets) {
      process.stdout.write(`Guarded PostgreSQL suite: ${target}\n`);
      const run = spawnSync(process.execPath, [path.join(__dirname, "with-isolated-postgres.js"), target],
        { cwd: path.join(__dirname, ".."), env, stdio: "inherit", windowsHide: true });
      if (run.error || run.status !== 0) throw new Error(`${target} failed (${run.error?.message || run.status})`);
    }
  } finally { cleanup(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
