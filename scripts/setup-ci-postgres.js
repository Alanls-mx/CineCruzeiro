const fs = require("fs");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { assertDisposableTestServer } = require("./test-postgres-safety");

function docker(args, input) {
  const result = spawnSync("docker", args, { encoding: "utf8", input });
  if (result.error || result.status !== 0) throw new Error(`Falha ao preparar PostgreSQL do CI: ${result.error?.message || result.stderr}`);
  return result.stdout.trim();
}

async function main() {
  const containerId = process.env.POSTGRES_SERVICE_CONTAINER_ID || "";
  const port = Number(process.env.POSTGRES_SERVICE_PORT);
  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_ENV || !/^[a-f0-9]{64}$/.test(containerId)
      || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Prepare a instância somente no job PostgreSQL do GitHub Actions.");
  }
  const container = JSON.parse(docker(["inspect", containerId]))[0];
  if (container?.Config?.Image !== "postgres:16-alpine"
      || !container?.NetworkSettings?.Ports?.["5432/tcp"]?.some((binding) => Number(binding.HostPort) === port)) {
    throw new Error("O contêiner ou a porta PostgreSQL do CI não correspondem ao serviço esperado.");
  }

  const password = crypto.randomBytes(24).toString("hex");
  const token = crypto.randomBytes(16).toString("hex");
  const sql = `CREATE ROLE cine_test_admin LOGIN CREATEDB PASSWORD '${password}';
CREATE TABLE cine_test_server_marker (id integer PRIMARY KEY CHECK (id = 1), token text NOT NULL);
INSERT INTO cine_test_server_marker (id, token) VALUES (1, '${token}');
GRANT SELECT ON cine_test_server_marker TO cine_test_admin;`;
  docker(["exec", "-i", containerId, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], sql);

  const url = `postgresql://cine_test_admin:${password}@127.0.0.1:${port}/postgres`;
  process.env.NODE_ENV = "test";
  await assertDisposableTestServer(url, token);
  process.stdout.write(`::add-mask::${password}\n::add-mask::${url}\n::add-mask::${token}\n`);
  fs.appendFileSync(process.env.GITHUB_ENV, `TEST_POSTGRES_ADMIN_URL=${url}\nCINE_TEST_SERVER_TOKEN=${token}\n`);
  console.log("Instância PostgreSQL descartável do CI verificada.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
