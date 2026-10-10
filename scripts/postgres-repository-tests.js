const { spawnSync } = require("child_process");
const path = require("path");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");

async function main() {
  await assertDisposableTestDatabase();
  for (const args of [
    [path.join(__dirname, "db-migrate.js")],
    ["--test", path.join(__dirname, "..", "tests", "admin-repositories-postgres.test.mjs")]
  ]) {
    const child = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
    if (child.error) throw child.error;
    if (child.status !== 0) { process.exitCode = child.status || 1; return; }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
