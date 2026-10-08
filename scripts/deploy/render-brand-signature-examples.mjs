#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ports = {
  "cine-estacao-amparo": 4120,
  "cinemax-piraju": 4110,
  "cine-gama": 4130,
  "cinemania-cosmopolis": 4140
};
const slug = process.argv[2];
if (process.platform !== "linux" || !ports[slug]) throw new Error("Informe um cinema valido na VPS.");

const envPath = path.join("/home/ubuntu/projects", slug, "shared/backend.runtime.env");
const env = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
if (!env.STUDIO_AUTOMATION_TOKEN) throw new Error("Token de automacao do Studio ausente.");

async function request(route, body) {
  const response = await fetch(`http://127.0.0.1:${ports[slug]}${route}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.STUDIO_AUTOMATION_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${data.error?.code || ""}`);
  return data;
}

const context = await request("/api/studio/context");
const item = context.concessions.find((candidate) => candidate.id === "combo-classico" && candidate.imageUrl);
if (!item) throw new Error(`${slug}: combo-classico sem imagem no catalogo.`);
const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).replaceAll("-", "");
const created = await request("/api/studio/campaigns/generate", {
  cinemaId: slug,
  campaignType: "concession",
  templateId: "concession-combo",
  objective: `Divulgar ${item.name} no ${context.cinema.name}`,
  subject: { concessionId: item.id, copyDensity: "short" },
  formats: ["feed_portrait"],
  variationCount: 1,
  idempotencyKey: `signature-white-3d-${date}-${slug}-${item.id}`
});
const id = created.campaign?.id;
if (!id) throw new Error(`${slug}: campanha sem identificador.`);

for (let attempt = 0; attempt < 90; attempt += 1) {
  const { campaign } = await request(`/api/studio/campaigns/${id}`);
  if (campaign.status === "ready") {
    const composition = campaign.result?.compositions?.[0];
    if (!composition?.previewUrl) throw new Error(`${slug}: campanha sem imagem final.`);
    console.log(`SIGNATURE_SAMPLE=${JSON.stringify({ slug, id, previewUrl: composition.previewUrl, quality: composition.quality?.total || 0 })}`);
    process.exit(0);
  }
  if (campaign.status === "failed") throw new Error(`${slug}: ${campaign.error?.code || "renderizacao falhou"}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
throw new Error(`${slug}: campanha nao terminou em tres minutos.`);
