const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cinecruzeiro-e2e-"));
const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, CINE_E2E_DATA_DIR: dataDir },
  stdio: "inherit"
});

let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  if (fs.existsSync(dataDir) && path.dirname(fs.realpathSync(dataDir)) === fs.realpathSync(os.tmpdir()) && path.basename(dataDir).startsWith("cinecruzeiro-e2e-")) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(code);
}

child.on("error", (error) => {
  console.error(error);
  finish(1);
});
child.on("exit", (code, signal) => finish(code ?? (signal ? 1 : 0)));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
