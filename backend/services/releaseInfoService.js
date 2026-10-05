const fs = require("node:fs");
const path = require("node:path");

function readReleaseInfo({ rootDir = path.resolve(__dirname, "../..") } = {}) {
  const packageInfo = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const manifestPath = path.join(rootDir, "release-info.json");
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {}

  const commit = String(manifest.commit || "");
  const commitShort = String(manifest.commitShort || commit.slice(0, 7));
  return {
    appVersion: String(packageInfo.version || "0.0.0"),
    version: commitShort ? `${packageInfo.version || "0.0.0"}+${commitShort}` : String(packageInfo.version || "0.0.0"),
    commit,
    commitShort,
    release: String(manifest.release || ""),
    previousRelease: String(manifest.previousRelease || ""),
    summary: String(manifest.summary || "Versão inicial sem notas de release."),
    files: Array.isArray(manifest.files) ? manifest.files.map(String).slice(0, 200) : [],
    deployedAt: String(manifest.deployedAt || "")
  };
}

module.exports = { readReleaseInfo };
