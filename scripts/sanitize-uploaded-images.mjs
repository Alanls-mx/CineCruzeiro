import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const { hasAiFilenamePrefix, normalizeImageBaseName, sanitizeImageBuffer } = require("../backend/services/storageService");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const rootArg = args.find((item) => item.startsWith("--root="))?.slice("--root=".length);
const uploadsRoot = path.resolve(rootArg || process.env.CINE_UPLOADS_DIR || "backend/public/uploads");
const dataFile = process.env.CINE_DATA_FILE ? path.resolve(process.env.CINE_DATA_FILE) : "";
const types = new Map([[".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"], [".webp", "image/webp"]]);

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function publicUrl(filePath) {
  return `/uploads/${path.relative(uploadsRoot, filePath).replaceAll(path.sep, "/")}`;
}

async function imageFiles(folder) {
  const output = [];
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) output.push(...await imageFiles(target));
    else if (entry.isFile() && types.has(path.extname(entry.name).toLowerCase())) output.push(target);
  }
  return output;
}

function replacementTarget(filePath) {
  if (!hasAiFilenamePrefix(path.basename(filePath))) return filePath;
  const extension = path.extname(filePath).toLowerCase();
  const nextBase = normalizeImageBaseName(path.basename(filePath));
  const identity = crypto.createHash("sha256").update(publicUrl(filePath)).digest("hex").slice(0, 8);
  return path.join(path.dirname(filePath), `${nextBase}-${identity}${extension === ".jpeg" ? ".jpg" : extension}`);
}

function replaceDeep(value, replacements) {
  if (typeof value === "string") {
    let result = value;
    for (const [before, after] of replacements) result = result.replaceAll(before, after);
    return result;
  }
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, replacements));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceDeep(item, replacements)]));
  return value;
}

async function updateJsonReferences(replacements) {
  if (!dataFile || !replacements.length) return 0;
  const source = await fs.readFile(dataFile, "utf8").catch(() => "");
  if (!source) return 0;
  const next = `${JSON.stringify(replaceDeep(JSON.parse(source), replacements), null, 2)}\n`;
  if (next === source) return 0;
  const temporary = `${dataFile}.image-sanitize-${process.pid}.tmp`;
  await fs.writeFile(temporary, next, { mode: 0o600 });
  await fs.rename(temporary, dataFile);
  return 1;
}

async function updatePostgresReferences(replacements) {
  if (!process.env.DATABASE_URL || !replacements.length) return 0;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let updated = 0;
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
      ORDER BY table_name, ordinal_position
    `);
    for (const [before, after] of replacements) {
      for (const column of result.rows) {
        const table = `${quoteIdentifier(column.table_schema)}.${quoteIdentifier(column.table_name)}`;
        const field = quoteIdentifier(column.column_name);
        const expression = column.data_type === "jsonb"
          ? `replace(${field}::text, $1, $2)::jsonb`
          : column.data_type === "json"
            ? `replace(${field}::text, $1, $2)::json`
            : `replace(${field}, $1, $2)`;
        const response = await client.query(`UPDATE ${table} SET ${field} = ${expression} WHERE ${field}::text LIKE '%' || $1 || '%'`, [before, after]);
        updated += response.rowCount || 0;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
  return updated;
}

const files = await imageFiles(uploadsRoot);
const plans = files.map((source) => ({ source, target: replacementTarget(source), contentType: types.get(path.extname(source).toLowerCase()) }));
const renamed = plans.filter((item) => item.source !== item.target);
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", uploadsRoot, images: plans.length, renameCandidates: renamed.map((item) => ({ from: publicUrl(item.source), to: publicUrl(item.target) })) }, null, 2));
if (!apply) process.exit(0);

const completedRenames = [];
let appliedReplacements = [];
try {
  for (const plan of plans) {
    const buffer = await fs.readFile(plan.source);
    const sanitized = await sanitizeImageBuffer(buffer, plan.contentType);
    const temporary = `${plan.source}.sanitize-${process.pid}.tmp`;
    await fs.writeFile(temporary, sanitized, { mode: 0o644 });
    await fs.rename(temporary, plan.source);
    if (plan.source !== plan.target) {
      await fs.access(plan.target).then(() => { throw new Error(`Destino já existe: ${plan.target}`); }).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
      await fs.rename(plan.source, plan.target);
      completedRenames.push(plan);
    }
  }
  appliedReplacements = completedRenames.map((item) => [publicUrl(item.source), publicUrl(item.target)]);
  const postgresRows = await updatePostgresReferences(appliedReplacements);
  const jsonFiles = await updateJsonReferences(appliedReplacements);
  console.log(JSON.stringify({ sanitized: plans.length, renamed: appliedReplacements.length, postgresRows, jsonFiles }, null, 2));
} catch (error) {
  const reverse = appliedReplacements.map(([before, after]) => [after, before]);
  await updatePostgresReferences(reverse).catch(() => {});
  await updateJsonReferences(reverse).catch(() => {});
  for (const plan of completedRenames.reverse()) await fs.rename(plan.target, plan.source).catch(() => {});
  throw error;
}
