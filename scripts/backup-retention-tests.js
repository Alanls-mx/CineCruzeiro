const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cine-retention-"));
try {
  const now = new Date();
  for (let day = 0; day < 400; day += 1) {
    const date = new Date(now.getTime() - day * 86400000);
    const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const name = `cinecruzeiro-${stamp}.tar.gz.gpg`;
    fs.writeFileSync(path.join(directory, name), "ciphertext");
    fs.writeFileSync(path.join(directory, `${name}.sha256`), "checksum");
  }
  execFileSync(process.execPath, [path.join(__dirname, "prune-backups.js"), directory], { stdio: "inherit" });
  const remaining = fs.readdirSync(directory).filter((name) => name.endsWith(".tar.gz.gpg"));
  assert.ok(remaining.length >= 14, `Retenção diária incompleta: ${remaining.length}`);
  assert.ok(remaining.length <= 35, `Retenção excessiva: ${remaining.length}`);
  assert.ok(remaining.some((name) => name.includes(String(now.getUTCFullYear() - 1))), "Retenção mensal não preservou histórico anual");
  assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith(".sha256")).length, remaining.length);
  console.log("BACKUP_RETENTION_TESTS_OK");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
