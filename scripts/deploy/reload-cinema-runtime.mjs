#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const slug = process.argv[2];
if (process.platform !== "linux" || !/^(cinemax-piraju|cine-gama|cinemania-cosmopolis)$/.test(slug || "")) {
  throw new Error("Uso na VPS: node reload-cinema-runtime.mjs <slug>");
}
const base = path.join("/home/ubuntu/projects", slug);
function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
    const split = line.indexOf("=");
    return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")];
  }));
}
const env = {
  ...process.env,
  ...parseEnv(path.join(base, "shared/backend.runtime.env")),
  ...parseEnv(path.join(base, "shared/backend.env.local")),
};
const result = spawnSync("pm2", ["startOrReload", path.join(base, "ecosystem.config.cjs"), "--only", `${slug}-backend`, "--update-env"], {
  cwd: base,
  env,
  stdio: "pipe",
  encoding: "utf8",
});
if (result.status !== 0) throw new Error(`Falha ao recarregar ${slug}: ${result.stderr || result.stdout}`);
console.log(`${slug}: backend recarregado com credenciais isoladas.`);
