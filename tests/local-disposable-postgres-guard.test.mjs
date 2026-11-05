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

test("upgrade exige PostgreSQL 18 antes de criar contêiner", () => {
  const run = spawnSync(process.execPath, [script, "upgrade"], { cwd: root, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "", POSTGRES_URL: "", TEST_DATABASE_URL: "",
      TEST_POSTGRES_ADMIN_URL: "", CINE_TEST_SERVER_TOKEN: "" } });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /exige --pg18/);
});
