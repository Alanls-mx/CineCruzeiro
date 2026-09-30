#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const slugs = ["cinecruzeiro", "cine-estacao-amparo", "cinemax-piraju", "cine-gama", "cinemania-cosmopolis"];
const manifestDir = process.argv[2] || "scratch/poster-manifests";
const outputDir = process.argv[3] || "output/studio-all-cinemas/final-2026-09-30";
const jobs = [];

for (const slug of slugs) {
  const manifest = JSON.parse(await fs.readFile(path.join(manifestDir, `${slug}.json`), "utf8"));
  if (manifest.cinema !== slug) throw new Error(`Manifesto incorreto para ${slug}.`);
  for (const result of manifest.results) {
    if (result.status !== "ready") throw new Error(`${slug}/${result.key}: ${result.status} (${result.error || "sem detalhe"})`);
    const specialCopy = result.key === "bomboniere-combo-familia" || (slug === "cinemania-cosmopolis" && result.key === "bomboniere-foto-tematica");
    const expectedRevision = result.key === "programacao-hoje" ? "signature-v4-upcoming"
      : specialCopy ? "signature-v2-copy-v1"
      : result.campaignType === "schedule" ? "signature-v3" : "signature-v2";
    if (result.revision !== expectedRevision) throw new Error(`${slug}/${result.key}: versao ${result.revision}, esperada ${expectedRevision}.`);
    if (!/^\/uploads\/social-studio-automation\/[\w.-]+\.png$/.test(result.previewUrl)) {
      throw new Error(`${slug}/${result.key}: URL de previa invalida.`);
    }
    jobs.push({ slug, ...result });
  }
}

await fs.mkdir(outputDir, { recursive: true });
let next = 0;
let completed = 0;
const failures = [];
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const destination = path.join(outputDir, `${job.slug}-${job.key}.png`);
    try {
      const url = `https://lumixengine.com/projects/${job.slug}${job.previewUrl}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Resposta nao e PNG.");
      const metadata = await sharp(buffer).metadata();
      if (metadata.width !== 1080 || metadata.height !== 1350) throw new Error(`Dimensoes ${metadata.width}x${metadata.height}.`);
      await fs.writeFile(destination, buffer);
      completed += 1;
      console.log(`${completed}/${jobs.length} ${path.basename(destination)}`);
    } catch (error) {
      failures.push(`${job.slug}/${job.key}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: 5 }, worker));
if (failures.length) throw new Error(`Falha em ${failures.length} imagem(ns): ${failures.join("; ")}`);
console.log(`IMAGES_READY=${completed};DIRECTORY=${path.resolve(outputDir)}`);
