#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const slug = process.argv[2];
const allowed = ["cine-estacao-amparo", "cinemax-piraju", "cine-gama", "cinemania-cosmopolis"];
if (process.platform !== "linux" || !allowed.includes(slug)) throw new Error("Informe um dos quatro cinemas na VPS.");
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const shared = `/home/ubuntu/projects/${slug}/shared`;
const env = Object.fromEntries((await fs.readFile(path.join(shared, "backend.runtime.env"), "utf8"))
  .split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")];
  }));
if (!env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");

const images = {
  clubHeroImageUrl: "club-hero",
  clubBannerImageUrl: "club-banner",
  eventHeroImageUrl: "events-hero",
  eventGamesImageUrl: "events-games",
  eventPartiesImageUrl: "events-parties",
  eventCorporateImageUrl: "events-corporate",
  eventGalleryImageUrl: "events-gallery",
};
const replacements = Object.fromEntries(Object.entries(images).map(([key, name]) => [key, `/images/cinema-editorial/${slug}/${name}.webp`]));
for (const url of Object.values(replacements)) {
  const file = path.join(`/home/ubuntu/projects/${slug}/current/public`, url.slice(1));
  await fs.access(file);
}

const client = new Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`editorial-images:${slug}`]);
  const row = (await client.query("SELECT value FROM settings WHERE key = 'app' FOR UPDATE")).rows[0];
  if (!row) throw new Error("Configuracoes do site ausentes.");
  const previous = Object.fromEntries(Object.keys(images).map((key) => [key, row.value?.[key] || ""]));
  const backup = path.join(shared, `editorial-images-before-${slug}.json`);
  try { await fs.access(backup); } catch { await fs.writeFile(backup, JSON.stringify(previous, null, 2)); }
  await client.query("UPDATE settings SET value = value || $1::jsonb, updated_at = now() WHERE key = 'app'", [JSON.stringify(replacements)]);
  await client.query("COMMIT");
  console.log(`EDITORIAL_IMAGES_READY=${slug};COUNT=${Object.keys(replacements).length}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
