#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ports = { "cinemax-piraju": 4110, "cine-gama": 4130, "cinemania-cosmopolis": 4140 };
const slug = process.argv[2];
if (process.platform !== "linux" || !ports[slug]) throw new Error("Uso na VPS: node check-cinema-automation.mjs <slug>");
const file = path.join("/home/ubuntu/projects", slug, "shared/backend.runtime.env");
const env = Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
}));
for (const [name, route, token] of [
  ["E-mail", "/api/email-automation/context", env.EMAIL_AUTOMATION_TOKEN],
]) {
  const response = await fetch(`http://127.0.0.1:${ports[slug]}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${slug} ${name}: HTTP ${response.status}, ${data.error?.code || "erro"}`);
  console.log(`${slug} ${name}: autenticado, contexto disponível.`);
}
