#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/projects";
const backendFile = path.join(root, "cine-estacao-amparo/shared/backend.runtime.env");
const n8nFile = path.join(root, "cinecruzeiro/automation/n8n/.env");

function readEnv(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo de configuração ausente: ${file}`);
  const content = fs.readFileSync(file, "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
  }));
  return { content, values };
}

function updateEnv(file, original, entries) {
  let content = original;
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  }
  if (content === original) return;
  const backup = `${file}.pre-estacao-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  fs.copyFileSync(file, backup);
  fs.chmodSync(backup, 0o600);
  fs.writeFileSync(file, content, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

if (process.platform !== "linux") throw new Error("Execute este provisionamento somente na VPS.");
const backend = readEnv(backendFile);
const n8n = readEnv(n8nFile);
const emailToken = backend.values.EMAIL_AUTOMATION_TOKEN || n8n.values.ESTACAO_EMAIL_AUTOMATION_TOKEN || crypto.randomBytes(32).toString("hex");

updateEnv(backendFile, backend.content, {
  EMAIL_AUTOMATION_TOKEN: emailToken,
  EMAIL_AUTOMATION_MODE: "draft",
});
updateEnv(n8nFile, n8n.content, {
  ESTACAO_EMAIL_AUTOMATION_BASE_URL: "https://lumixengine.com/projects/cine-estacao-amparo",
  ESTACAO_EMAIL_AUTOMATION_TOKEN: emailToken,
});
console.log("Cine Estação: tokens independentes configurados; e-mail em modo rascunho.");
