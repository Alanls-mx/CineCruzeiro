#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE_PATTERN = /^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROCESS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requiredString(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} e obrigatorio.`);
  return normalized;
}

function normalizedInstance(raw, index) {
  const prefix = `instances[${index}]`;
  const slug = requiredString(raw?.slug, `${prefix}.slug`);
  const route = requiredString(raw?.route, `${prefix}.route`).replace(/\/+$/, "");
  const siteUrl = requiredString(raw?.siteUrl, `${prefix}.siteUrl`).replace(/\/+$/, "");
  const baseDir = path.posix.normalize(requiredString(raw?.baseDir, `${prefix}.baseDir`));
  const frontendPort = Number(raw?.frontendPort);
  const backendPort = Number(raw?.backendPort);
  const frontendProcess = requiredString(raw?.frontendProcess, `${prefix}.frontendProcess`);
  const backendProcess = requiredString(raw?.backendProcess, `${prefix}.backendProcess`);

  if (!SLUG_PATTERN.test(slug)) throw new Error(`${prefix}.slug invalido: ${slug}`);
  if (!ROUTE_PATTERN.test(route)) throw new Error(`${prefix}.route invalida: ${route}`);
  if (!PROCESS_PATTERN.test(frontendProcess) || !PROCESS_PATTERN.test(backendProcess)) {
    throw new Error(`${prefix}: nomes de processos PM2 invalidos.`);
  }
  if (!baseDir.startsWith("/home/ubuntu/projects/") || baseDir === "/home/ubuntu/projects") {
    throw new Error(`${prefix}.baseDir deve ficar dentro de /home/ubuntu/projects.`);
  }
  if (!Number.isInteger(frontendPort) || frontendPort < 1024 || frontendPort > 65535) {
    throw new Error(`${prefix}.frontendPort invalida.`);
  }
  if (!Number.isInteger(backendPort) || backendPort < 1024 || backendPort > 65535) {
    throw new Error(`${prefix}.backendPort invalida.`);
  }
  if (frontendPort === backendPort) throw new Error(`${prefix}: frontend e backend usam a mesma porta.`);
  if (!siteUrl.endsWith(route)) throw new Error(`${prefix}.siteUrl deve terminar com ${route}.`);

  return {
    slug,
    enabled: raw.enabled !== false,
    brandFrom: String(raw.brandFrom || "Cine Cruzeiro").trim(),
    name: requiredString(raw.name, `${prefix}.name`),
    city: String(raw.city || "").trim(),
    instagram: String(raw.instagram || "").trim(),
    route,
    siteUrl,
    baseDir,
    frontendPort,
    backendPort,
    frontendProcess,
    backendProcess,
    applyBrand: raw.applyBrand === true,
  };
}

function ensureUnique(instances, field, label = field) {
  const seen = new Map();
  for (const instance of instances) {
    const value = instance[field];
    if (seen.has(value)) throw new Error(`${label} duplicado: ${value} (${seen.get(value)} e ${instance.slug}).`);
    seen.set(value, instance.slug);
  }
}

export function validateRegistry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Registro de instalacoes invalido.");
  if (Number(raw.schemaVersion) !== 1) throw new Error("schemaVersion deve ser 1.");
  const repository = requiredString(raw.repository, "repository");
  const keepReleases = Number(raw.keepReleases ?? 2);
  if (!Number.isInteger(keepReleases) || keepReleases < 1 || keepReleases > 10) {
    throw new Error("keepReleases deve ser um inteiro entre 1 e 10.");
  }
  if (!Array.isArray(raw.instances) || raw.instances.length === 0) throw new Error("Nenhuma instalacao cadastrada.");

  const instances = raw.instances.map(normalizedInstance);
  for (const field of ["slug", "route", "siteUrl", "baseDir", "frontendPort", "backendPort", "frontendProcess", "backendProcess"]) {
    ensureUnique(instances, field);
  }
  const ports = new Map();
  for (const instance of instances) {
    for (const [kind, port] of [["frontend", instance.frontendPort], ["backend", instance.backendPort]]) {
      if (ports.has(port)) throw new Error(`Porta duplicada: ${port} (${ports.get(port)} e ${instance.slug}/${kind}).`);
      ports.set(port, `${instance.slug}/${kind}`);
    }
  }

  return { schemaVersion: 1, repository, keepReleases, instances };
}

export function loadRegistry(filePath) {
  const absolute = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  return validateRegistry(parsed);
}

function usage() {
  console.error("Uso: node scripts/cinema-instance-registry.mjs <validate|list|plan> <arquivo.json> [slug]");
}

function main() {
  const [command, registryPath, selectedSlug] = process.argv.slice(2);
  if (!command || !registryPath) {
    usage();
    process.exitCode = 2;
    return;
  }
  const registry = loadRegistry(registryPath);
  let instances = registry.instances.filter((instance) => instance.enabled);
  if (selectedSlug) instances = instances.filter((instance) => instance.slug === selectedSlug);
  if (selectedSlug && instances.length === 0) throw new Error(`Instalacao habilitada nao encontrada: ${selectedSlug}`);

  if (command === "validate") {
    console.log(`REGISTRY_OK=${instances.length}`);
    return;
  }
  if (command === "list") {
    for (const instance of instances) console.log(instance.slug);
    return;
  }
  if (command === "plan") {
    console.log(`Repositorio: ${registry.repository}`);
    for (const instance of instances) {
      console.log(`${instance.slug}: ${instance.route} | frontend ${instance.frontendPort} | backend ${instance.backendPort} | ${instance.baseDir}`);
    }
    return;
  }
  usage();
  process.exitCode = 2;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(`REGISTRY_ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
