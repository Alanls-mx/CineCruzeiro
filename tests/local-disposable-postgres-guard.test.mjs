import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/with-local-disposable-postgres.js");

test("bootstrap Docker recusa URL herdada antes de criar contêiner", () => {
  const run = spawnSync(process.execPath, [script, "smoke"], { cwd: root, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://example.invalid/operational", TEST_DATABASE_URL: "",
      TEST_POSTGRES_ADMIN_URL: "", CINE_TEST_SERVER_TOKEN: "" } });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Remova DATABASE_URL/);
});

test("E2E PostgreSQL recusa URL operacional herdada antes de criar contêiner", () => {
  const run = spawnSync(process.execPath, [script, "e2e"], { cwd: root, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://example.invalid/operational", TEST_DATABASE_URL: "",
      TEST_POSTGRES_ADMIN_URL: "", CINE_TEST_SERVER_TOKEN: "" } });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Remova DATABASE_URL/);
});

test("servidor E2E PostgreSQL recusa inicialização sem marcador de banco", () => {
  const run = spawnSync(process.execPath, [path.join(root, "scripts/e2e-dev-server.js")], {
    cwd: root, encoding: "utf8", timeout: 10000,
    env: { ...process.env, CINE_E2E_POSTGRES: "1", NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://127.0.0.1/production", CINE_TEST_DB_TOKEN: "",
      DATABASE_URL: "", POSTGRES_URL: "" }
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Banco de teste sem execução autorizada/);
});

test("upgrade exige PostgreSQL 18 antes de criar contêiner", () => {
  const run = spawnSync(process.execPath, [script, "upgrade"], { cwd: root, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "", POSTGRES_URL: "", TEST_DATABASE_URL: "",
      TEST_POSTGRES_ADMIN_URL: "", CINE_TEST_SERVER_TOKEN: "" } });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /exige --pg18/);
});
