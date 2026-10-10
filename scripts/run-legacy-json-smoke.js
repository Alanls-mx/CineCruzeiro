const { spawnSync } = require("child_process");
const path = require("path");

const child = spawnSync(process.execPath, [path.join(__dirname, "smoke-tests.js")], {
  stdio: "inherit",
  env: { ...process.env, CINE_SMOKE_MODE: "json", TEST_DATABASE_URL: "", CINE_TEST_DB_TOKEN: "", DATABASE_URL: "", POSTGRES_URL: "" }
});
if (child.error) throw child.error;
process.exitCode = child.status || (child.signal ? 1 : 0);
