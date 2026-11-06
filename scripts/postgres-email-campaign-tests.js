const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");

async function main() {
  await assertDisposableTestDatabase();
  for (const args of [
    [path.join(__dirname, "db-migrate.js")],
    ["--test", path.join(__dirname, "..", "tests", "email-campaign-postgres.test.mjs")]
  ]) {
    const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
    if (result.error || result.status !== 0) throw new Error(`email-campaign failed (${result.error?.message || result.status})`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
