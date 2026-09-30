#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const slugs = new Set(["cinecruzeiro", "cine-estacao-amparo", "cinemax-piraju", "cine-gama", "cinemania-cosmopolis"]);
const slug = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (process.platform !== "linux" || !slugs.has(slug)) throw new Error("Uso na VPS: node scripts/deploy/seed-cinema-catalog.mjs <slug> [--dry-run]");

const base = path.join("/home/ubuntu/projects", slug);
const assetDir = path.join("/home/ubuntu/projects/catalog-assets", slug);
const uploadDir = path.join(base, "shared/uploads");
const hasNewImages = slug !== "cinecruzeiro" && slug !== "cine-estacao-amparo";
const items = [
  { id: "pipoca-doce", name: "Pipoca Doce Caramelizada", description: "Pipoca com cobertura de caramelo, porção individual.", category: "pipoca", price: 19, sort: 35 },
  { id: "agua-mineral", name: "Água Mineral 500 ml", description: "Água mineral sem gás, garrafa de 500 ml.", category: "bebida", price: 6, sort: 45 },
  { id: "nachos-queijo", name: "Nachos com Queijo", description: "Nachos crocantes com molho de queijo servido à parte.", category: "salgado", price: 17, sort: 55 },
  { id: "bala-de-goma", name: "Bala de Goma", description: "Porção individual de balas de goma sortidas.", category: "doce", price: 9, sort: 65 },
];
const existingItems = ["combo-classico", "pipoca-grande", "refrigerante", "combo-familia", "chocolate-cinema", "foto-tematica"];
const plans = ["individual", "duplo", "plano-familia"];

function envValues(content) {
  return Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
}

async function copyAsset(name, kind) {
  const source = path.join(assetDir, name);
  const targetDir = path.join(uploadDir, kind);
  await fs.access(source);
  if (!dryRun) {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(source, path.join(targetDir, name));
  }
  return `/projects/${slug}/uploads/${kind}/${name}`;
}

const runtime = envValues(await fs.readFile(path.join(base, "shared/backend.runtime.env"), "utf8"));
const local = await fs.readFile(path.join(base, "shared/backend.env.local"), "utf8").then(envValues).catch(() => ({}));
const databaseUrl = local.DATABASE_URL || runtime.DATABASE_URL || local.POSTGRES_URL || runtime.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ausente.");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const existing = await client.query("SELECT id, name, image_url FROM concessions ORDER BY id");
  const activePlans = await client.query("SELECT id, name, image_url FROM subscription_plans ORDER BY id");
  console.log(`${slug}: ${existing.rowCount} produtos, ${activePlans.rowCount} planos antes da atualização${dryRun ? " (simulação)" : ""}.`);
  if (hasNewImages) {
    for (const id of existingItems) if (!existing.rows.some((row) => row.id === id)) throw new Error(`Produto base ausente: ${id}`);
    for (const id of plans) if (!activePlans.rows.some((row) => row.id === id)) throw new Error(`Plano base ausente: ${id}`);
  }
  const images = new Map();
  for (const item of items) images.set(item.id, await copyAsset(`${item.id}.webp`, "concessions"));
  if (hasNewImages) {
    for (const id of existingItems) images.set(id, await copyAsset(`${id}.webp`, "concessions"));
    for (const id of plans) await copyAsset(`clube-${id}.webp`, "club-plans");
  }
  if (dryRun) {
    console.log(`${slug}: arquivos verificados; ${items.length} novas variedades e ${hasNewImages ? existingItems.length + plans.length : 0} mídias existentes seriam atualizadas.`);
  } else {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(`INSERT INTO concessions (id, sku, name, description, image_url, price, category, sort_order, active)
        VALUES ($1,$1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = now()`,
      [item.id, item.name, item.description, images.get(item.id), item.price, item.category, item.sort]);
      await client.query("INSERT INTO concession_inventory (concession_id, available, reserved, sold) VALUES ($1, NULL, 0, 0) ON CONFLICT (concession_id) DO NOTHING", [item.id]);
    }
    if (hasNewImages) {
      for (const id of existingItems) {
        await client.query("UPDATE concessions SET image_url=$2, updated_at=now() WHERE id=$1", [id, images.get(id)]);
      }
      await client.query("UPDATE concessions SET description = replace(description, 'Cine Cruzeiro', $1), updated_at=now() WHERE id='foto-tematica' AND description LIKE '%Cine Cruzeiro%'", [slug === "cinemax-piraju" ? "Cinemax Piraju" : slug === "cine-gama" ? "Cine Gama" : "CineMania Cosmópolis"]);
      for (const id of plans) {
        await client.query("UPDATE subscription_plans SET image_url=$2, updated_at=now() WHERE id=$1", [id, `/projects/${slug}/uploads/club-plans/clube-${id}.webp`]);
      }
    }
    await client.query("COMMIT");
    console.log(`${slug}: catálogo atualizado sem alterar preços ou benefícios dos itens existentes.`);
  }
} catch (error) {
  if (!dryRun) await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
