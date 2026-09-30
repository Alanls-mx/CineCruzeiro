#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ports = {
  cinecruzeiro: 4100,
  "cine-estacao-amparo": 4120,
  "cinemax-piraju": 4110,
  "cine-gama": 4130,
  "cinemania-cosmopolis": 4140,
};
const slug = process.argv[2];
if (process.platform !== "linux" || !ports[slug]) throw new Error("Informe um cinema valido na VPS.");

const envFile = `/home/ubuntu/projects/${slug}/shared/backend.runtime.env`;
const env = Object.fromEntries((await fs.readFile(envFile, "utf8")).split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")];
  }));
if (!env.STUDIO_AUTOMATION_TOKEN) throw new Error("Token do Studio ausente.");

const base = `http://127.0.0.1:${ports[slug]}`;
const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const movieRevision = "signature-v2";
const scheduleRevision = "signature-v4-aligned";
const weekEnd = new Date(`${date}T12:00:00Z`);
weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
const lastWeekDate = weekEnd.toISOString().slice(0, 10);
const manifestPath = `/home/ubuntu/projects/${slug}/shared/studio-all-posters-${date}.json`;

async function request(route, body) {
  const response = await fetch(`${base}${route}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.STUDIO_AUTOMATION_TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${data.error?.code || ""}`);
  return data;
}

const context = await request("/api/studio/context");
const movies = context.movies.filter((movie) => movie.catalogued && (movie.posterUrl || movie.backdropUrl));
const concessions = context.concessions.filter((item) => item.imageUrl && Number(item.price) > 0);
const now = Date.now();
const futureSession = (session) => {
  const startsAt = Date.parse(session.startsAt || `${session.date}T${session.time}:00-03:00`);
  return Number.isFinite(startsAt) && startsAt > now;
};
const scheduled = movies.filter((movie) => movie.sessions.some((session) => session.date >= date && session.date <= lastWeekDate && futureSession(session)));
const today = scheduled.filter((movie) => movie.sessions.some((session) => session.date === date && futureSession(session)));

const jobs = [
  ...movies.map((movie) => ({
    key: `filme-${movie.id}`, title: movie.title, campaignType: "movie", templateId: "movie-highlight",
    subject: { movieId: movie.id, copyDensity: "short" },
  })),
  ...concessions.map((item) => ({
    key: `bomboniere-${item.id}`, title: item.name, campaignType: "concession",
    templateId: item.category === "combo" || /combo/i.test(item.name) ? "concession-combo" : "concession-offer",
    subject: { concessionId: item.id, copyDensity: "short" },
  })),
  ...(today.length ? [{
    key: "programacao-hoje", title: "Programacao de hoje", campaignType: "schedule", templateId: "sessions-today",
    subject: { movieIds: today.map((movie) => movie.id), periodStart: date, copyDensity: "short" },
  }] : []),
  ...(scheduled.length ? [
    {
      key: "programacao-semana", title: "Programacao da semana", campaignType: "schedule", templateId: "sessions-week",
      subject: { movieIds: scheduled.map((movie) => movie.id), periodStart: date, copyDensity: "short" },
    },
    {
      key: "programacao-filmes", title: "Filmes em cartaz", campaignType: "schedule", templateId: "multi-movies",
      subject: { movieIds: scheduled.map((movie) => movie.id), periodStart: date, copyDensity: "short" },
    },
  ] : []),
];
const selectedJobs = process.argv.includes("--pilot") ? jobs.slice(0, 1) : jobs;
const refresh = process.argv.includes("--refresh");

let manifest;
try {
  manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch {
  manifest = { cinema: slug, generatedAt: new Date().toISOString(), results: [] };
}
for (const job of selectedJobs) {
  const specialCopy = job.key === "bomboniere-combo-familia" || (slug === "cinemania-cosmopolis" && job.key === "bomboniere-foto-tematica");
  const revision = job.key === "programacao-hoje" ? "signature-v4-upcoming"
    : specialCopy ? "signature-v2-copy-v1"
    : job.campaignType === "schedule" ? scheduleRevision : movieRevision;
  if (manifest.results.some((result) => result.key === job.key && result.status === "ready" && result.revision === revision) && !refresh) continue;
  let result;
  try {
    const alternatives = job.campaignType === "concession"
      ? [job.templateId, job.templateId === "concession-combo" ? "concession-offer" : "concession-combo"]
      : [job.templateId];
    for (const [variant, templateId] of alternatives.entries()) {
      const created = await request("/api/studio/campaigns/generate", {
        cinemaId: slug,
        campaignType: job.campaignType,
        templateId,
        objective: `Divulgar ${job.title} no ${context.cinema.name}`,
        subject: specialCopy ? {
          ...job.subject,
          title: job.key === "bomboniere-combo-familia" ? "Combo Família" : "Foto Temática",
          subtitle: job.key === "bomboniere-combo-familia" ? "PARA DIVIDIR" : "UMA LEMBRANÇA DO CINEMA",
          auxiliaryText: job.key === "bomboniere-combo-familia" ? "Pipoca, bebidas e chocolate." : "Registre seu momento no cinema.",
          cta: "PEÇA NO BALCÃO",
          actionDestination: `https://www.${slug.replaceAll("-", "")}.com.br`,
        } : job.subject,
        formats: ["feed_portrait"],
        variationCount: 1,
        copyOptions: { seed: variant * 37, ...(specialCopy ? { locks: { headline: true, kicker: true, supportingText: true, cta: true } } : {}) },
        idempotencyKey: `all-posters-${date}-${slug}-${job.key}-${revision}${refresh ? "-refresh" : ""}-v${variant}${specialCopy ? "-accent" : ""}`,
      });
      const id = created.campaign?.id;
      if (!id) throw new Error("Campanha sem identificador.");
      let campaign;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        campaign = (await request(`/api/studio/campaigns/${id}`)).campaign;
        if (["ready", "failed"].includes(campaign.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const composition = campaign?.result?.compositions?.[0];
      result = {
        ...job, templateId, revision, id, status: campaign?.status || "timeout",
        previewUrl: composition?.previewUrl || "", quality: composition?.quality?.total || 0,
        error: campaign?.error?.code || "",
      };
      if (result.status === "ready" || result.error !== "STUDIO_QA_REJECTED") break;
    }
  } catch (error) {
    result = { ...job, revision, status: "failed", previewUrl: "", error: error.message };
  }
  manifest.results = [...manifest.results.filter((item) => item.key !== job.key), result];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`${slug} ${manifest.results.length}/${jobs.length} ${job.key}: ${result.status}${result.error ? ` [${result.error}]` : ""}`);
}
console.log(`MANIFEST=${manifestPath}`);
