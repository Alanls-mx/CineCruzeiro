#!/usr/bin/env node

import fs from "node:fs/promises";

const base = "http://127.0.0.1:4120";
const token = process.env.STUDIO_AUTOMATION_TOKEN;
const output = "/home/ubuntu/projects/cine-estacao-amparo/shared/studio-posters-20260929.json";
if (!token) throw new Error("STUDIO_AUTOMATION_TOKEN ausente.");

async function json(route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${route}: ${response.status} ${body.error?.code || ""}`);
  return body;
}

const content = await json("/api/content");
const movies = (content.nowPlaying || []).filter((movie) => movie.sessions?.length);
const concessions = (content.concessions || []).filter((item) => item.imageUrl && Number(item.price) > 0);
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const todaysMovies = movies.filter((movie) => movie.sessions.some((session) => session.date === today));
const campaigns = [
  ...movies.map((movie) => ({
    key: `filme-${movie.id}`, name: movie.title, campaignType: "movie", templateId: "movie-highlight",
    objective: `Filme em cartaz: ${movie.title}`, subject: { movieId: movie.id },
  })),
  ...concessions.map((item) => ({
    key: `bomboniere-${item.id}`, name: item.name, campaignType: "concession",
    templateId: /combo/i.test(item.name) ? "concession-combo" : "concession-offer",
    objective: `Bomboniere: ${item.name}`, subject: { concessionId: item.id },
  })),
  ...(todaysMovies.length ? [{
    key: "programacao-hoje", name: "Programação de hoje", campaignType: "schedule", templateId: "sessions-today",
    objective: "Programação de hoje", subject: { movieIds: todaysMovies.map((movie) => movie.id), periodStart: today },
  }] : []),
  ...(movies.length ? [{
    key: "programacao-semana", name: "Programação da semana", campaignType: "schedule", templateId: "sessions-week",
    objective: "Programação da semana", subject: { movieIds: movies.map((movie) => movie.id), periodStart: today },
  }] : []),
  {
    key: "compra-online", name: "Compra online", campaignType: "custom", templateId: "online-ticket",
    objective: "Compre ingressos online no Cine Estação Amparo", subject: {},
  },
];

const refresh = process.argv.includes("--refresh");
const selected = process.argv.includes("--pilot") ? campaigns.slice(0, 1) : refresh
  ? campaigns.filter((campaign) => ["programacao-hoje", "programacao-semana", "bomboniere-combo-classico", "bomboniere-foto-tematica"].includes(campaign.key))
  : campaigns;
const previous = refresh ? JSON.parse(await fs.readFile(output, "utf8")) : { results: [] };
const results = [...previous.results.filter((item) => !selected.some((campaign) => campaign.key === item.key))];
for (const campaign of selected) {
  try {
    const retryProduct = refresh && campaign.key.startsWith("bomboniere-");
    const created = await json("/api/studio/campaigns/generate", {
      method: "POST",
      body: JSON.stringify({
        cinemaId: "cine-estacao-amparo", campaignType: campaign.campaignType,
        templateId: retryProduct ? "concession-offer" : campaign.templateId,
        objective: campaign.objective,
        subject: retryProduct ? { ...campaign.subject, copyDensity: "short" } : campaign.subject,
        formats: ["feed_portrait"], variationCount: 1,
        idempotencyKey: `estacao-20260929-${campaign.key}${refresh ? "-v2" : ""}`,
      }),
    });
    const id = created.campaign?.id;
    if (!id) throw new Error("Campanha criada sem identificador.");
    let record;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      record = (await json(`/api/studio/campaigns/${id}`)).campaign;
      if (["ready", "failed"].includes(record.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const composition = record?.result?.compositions?.[0];
    results.push({
      key: campaign.key, name: campaign.name, id, status: record?.status || "timeout",
      previewUrl: composition?.previewUrl || "", quality: composition?.quality?.total || 0,
      error: record?.error?.code || "",
    });
  } catch (error) {
    results.push({ key: campaign.key, name: campaign.name, status: "failed", error: error.message });
  }
  await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  const last = results.find((item) => item.key === campaign.key);
  console.log(`${last.key}: ${last.status}${last.quality ? ` (${last.quality})` : ""}${last.error ? ` [${last.error}]` : ""}`);
}
console.log(`MANIFEST=${output}`);
