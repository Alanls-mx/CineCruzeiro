#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".html", ".css", ".json", ".sql"]);
const SOURCE_ROOTS = ["src", "backend", "public"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "data", "uploads", "logs", "tests", "test", "__tests__"]);

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compact(value) {
  return slugify(value).replace(/-/g, "");
}

function pascalCase(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join("");
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(target);
  }
  return files;
}

function replaceAllLiteral(value, from, to) {
  return from && from !== to ? value.split(from).join(to) : value;
}

function copyTree(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Argumento invalido: ${key || "(vazio)"}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function main() {
  const args = parseArgs();
  const root = path.resolve(args.root || process.cwd());
  const oldName = String(args["old-name"] || "Cine Cruzeiro").trim();
  const newName = String(args.name || "").trim();
  const oldRoute = `/${String(args["old-route"] || "projects/cinecruzeiro").replace(/^\/+|\/+$/g, "")}`;
  const newRoute = `/${String(args.route || "").replace(/^\/+|\/+$/g, "")}`;
  const oldCity = String(args["old-city"] || "São Paulo - SP").trim();
  const newCity = String(args.city || "").trim();
  const oldInstagram = String(args["old-instagram"] || "@cinecruzeiro.oficial").trim();
  const newInstagram = String(args.instagram || "").trim();
  const brandingDir = args["branding-dir"] ? path.resolve(args["branding-dir"]) : "";
  if (!newName || newRoute === "/") throw new Error("Nome e rota da instalacao sao obrigatorios.");

  const oldSlug = slugify(oldName);
  const newSlug = slugify(newName);
  const oldCompact = compact(oldName);
  const newCompact = compact(newName);
  const replacements = [
    [oldRoute, newRoute],
    [oldRoute.slice(1), newRoute.slice(1)],
    ["Rua do Cruzeiro, 450 - Bairro Cruzeiro, São Paulo - SP", newCity ? `Atendimento local em ${newCity}` : "Endereco em atualizacao"],
    [oldInstagram, newInstagram || "Instagram em atualizacao"],
    [oldName, newName],
    [oldName.toUpperCase(), newName.toUpperCase()],
    [oldName.toLowerCase(), newName.toLowerCase()],
    [oldSlug, newSlug],
    [oldCompact, newCompact],
    [oldCompact.toUpperCase(), newCompact.toUpperCase()],
    [pascalCase(oldName), pascalCase(newName)],
  ];
  if (oldCity && newCity) replacements.push([oldCity, newCity]);

  const files = SOURCE_ROOTS.flatMap((sourceRoot) => walk(path.join(root, sourceRoot)));
  for (const rootFile of ["next.config.mjs"]) {
    const target = path.join(root, rootFile);
    if (fs.existsSync(target)) files.push(target);
  }
  let changed = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    let updated = original;
    for (const [from, to] of replacements) updated = replaceAllLiteral(updated, from, to);
    if (updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      changed += 1;
    }
  }

  if (brandingDir) {
    copyTree(path.join(brandingDir, "public"), path.join(root, "public"));
    copyTree(path.join(brandingDir, "backend-public"), path.join(root, "backend", "public"));
  }
  console.log(`BRAND_OK=${newSlug};FILES_CHANGED=${changed}`);
}

try {
  main();
} catch (error) {
  console.error(`BRAND_ERROR: ${error.message}`);
  process.exitCode = 1;
}
