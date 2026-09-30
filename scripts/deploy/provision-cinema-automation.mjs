#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const cinemas = {
  "cinemax-piraju": { env: "PIRAJU", label: "Cinemax Piraju", id: "pirajuCine", hook: "cinemax-piraju" },
  "cine-gama": { env: "GAMA", label: "Cine Gama", id: "gamaCine", hook: "cine-gama" },
  "cinemania-cosmopolis": { env: "COSMOPOLIS", label: "CineMania Cosmópolis", id: "cosmopolisCine", hook: "cinemania-cosmopolis" },
};
const root = "/home/ubuntu/projects";
const slug = process.argv[2];
const cinema = cinemas[slug];
if (process.platform !== "linux" || !cinema) {
  throw new Error(`Uso na VPS: node scripts/deploy/provision-cinema-automation.mjs <${Object.keys(cinemas).join("|")}>`);
}

function readEnv(file) {
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
  const backup = `${file}.pre-${slug}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  fs.copyFileSync(file, backup);
  fs.chmodSync(backup, 0o600);
  fs.writeFileSync(file, content, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

const backendFile = path.join(root, slug, "shared/backend.runtime.env");
const automationDir = path.join(root, "cinecruzeiro/automation/n8n");
const n8nFile = path.join(automationDir, ".env");
const backend = readEnv(backendFile);
const n8n = readEnv(n8nFile);
const baseUrl = `https://lumixengine.com/projects/${slug}`;
const studioToken = backend.values.STUDIO_AUTOMATION_TOKEN || n8n.values[`${cinema.env}_STUDIO_AUTOMATION_TOKEN`] || crypto.randomBytes(32).toString("hex");
const emailToken = backend.values.EMAIL_AUTOMATION_TOKEN || n8n.values[`${cinema.env}_EMAIL_AUTOMATION_TOKEN`] || crypto.randomBytes(32).toString("hex");
if (studioToken === emailToken) throw new Error("Tokens de Studio e e-mail devem ser diferentes.");

updateEnv(backendFile, backend.content, {
  STUDIO_AUTOMATION_TOKEN: studioToken,
  EMAIL_AUTOMATION_TOKEN: emailToken,
  EMAIL_AUTOMATION_MODE: "draft",
});
updateEnv(n8nFile, n8n.content, {
  [`${cinema.env}_STUDIO_BASE_URL`]: baseUrl,
  [`${cinema.env}_STUDIO_AUTOMATION_TOKEN`]: studioToken,
  [`${cinema.env}_EMAIL_AUTOMATION_BASE_URL`]: baseUrl,
  [`${cinema.env}_EMAIL_AUTOMATION_TOKEN`]: emailToken,
});

const workflowDir = path.join(automationDir, "workflows");
const templates = fs.readdirSync(workflowDir).filter((file) => file.startsWith("estacao-") && file.endsWith(".json"));
for (const template of templates) {
  const original = fs.readFileSync(path.join(workflowDir, template), "utf8");
  const workflow = JSON.parse(original
    .replaceAll("ESTACAO", cinema.env)
    .replaceAll("estacaoCine", cinema.id)
    .replaceAll("Cine Estação", cinema.label)
    .replaceAll("cine-estacao", cinema.hook));
  workflow.active = false;
  const target = path.join(workflowDir, template.replace(/^estacao-/, `${slug}-`));
  fs.writeFileSync(target, `${JSON.stringify(workflow, null, 2)}\n`);
}
console.log(`${slug}: credenciais independentes configuradas; ${templates.length} fluxos preparados, inicialmente inativos; e-mail em rascunho.`);
