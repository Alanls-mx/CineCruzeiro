#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./cinema-instance-registry.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} falhou com codigo ${result.status}.`);
  return options.capture ? String(result.stdout || "").trim() : "";
}

function parseEnvFile(filePath) {
  const parsed = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[key] = value;
  }
  return parsed;
}

function randomSecret(bytes = 36) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function publicOrigin(siteUrl) {
  return new URL(siteUrl).origin;
}

function sqlIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Identificador PostgreSQL invalido: ${value}`);
  return `"${value}"`;
}

function writePrivate(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function ecosystem(instance) {
  return `const fs = require('fs');
const path = require('path');
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\\r?\\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}
const appRoot = '${instance.baseDir}/current';
const shared = '${instance.baseDir}/shared';
const backendEnv = { ...readEnv(path.join(shared, 'backend.runtime.env')), ...readEnv(path.join(shared, 'backend.env.local')) };
module.exports = { apps: [
  { name: '${instance.backendProcess}', cwd: appRoot, script: 'backend/server.js', instances: 1, exec_mode: 'fork', time: true, env: backendEnv },
  { name: '${instance.frontendProcess}', cwd: appRoot, script: 'npm', args: 'start -- -H 127.0.0.1', time: true, env: { NODE_ENV: 'production', PORT: '${instance.frontendPort}', HOSTNAME: '127.0.0.1', NEXT_PUBLIC_BASE_PATH: '${instance.route}', NEXT_BASE_PATH: '${instance.route}', CINE_BACKEND_URL: 'http://127.0.0.1:${instance.backendPort}', NEXT_PUBLIC_SITE_URL: '${instance.siteUrl}' } }
] };
`;
}

async function main() {
  if (process.platform !== "linux") throw new Error("Bootstrap disponivel apenas na VPS Linux.");
  const slug = String(process.argv[2] || "").trim();
  const brandingSource = String(process.argv[3] || "").trim();
  if (!slug || !brandingSource) throw new Error("Uso: node scripts/bootstrap-demo-instance-vps.mjs <slug> <diretorio-branding>");
  const registryPath = process.env.CINEMA_INSTANCES_FILE || "/home/ubuntu/projects/cinema-instances.json";
  const registry = loadRegistry(registryPath);
  const instance = registry.instances.find((entry) => entry.slug === slug);
  if (!instance || instance.slug === "cinecruzeiro") throw new Error(`Instalacao demonstrativa nao encontrada: ${slug}`);
  if (fs.existsSync(instance.baseDir)) throw new Error(`Diretorio ja existe; bootstrap recusado: ${instance.baseDir}`);
  if (!fs.existsSync(brandingSource)) throw new Error(`Branding nao encontrado: ${brandingSource}`);

  const databaseName = slug.replaceAll("-", "_");
  const databaseRole = databaseName;
  const databasePassword = randomSecret(30);
  const adminPassword = randomSecret(18);
  const adminEmail = `admin@${slug}.demo`;
  const runtimeSecret = randomSecret(48);
  const currentRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const sourceBase = "/home/ubuntu/projects/cinecruzeiro";
  const sourceEnv = {
    ...parseEnvFile(path.join(sourceBase, "shared", "backend.runtime.env")),
    ...parseEnvFile(path.join(sourceBase, "shared", "backend.env.local")),
  };
  if (!sourceEnv.DATABASE_URL) throw new Error("DATABASE_URL da instalacao-base ausente.");

  let roleCreated = false;
  let databaseCreated = false;
  try {
    fs.mkdirSync(path.join(instance.baseDir, "releases"), { recursive: true });
    fs.mkdirSync(path.join(instance.baseDir, "backups"), { recursive: true });
    fs.mkdirSync(path.join(instance.baseDir, "shared", "uploads"), { recursive: true });
    fs.mkdirSync(path.join(instance.baseDir, "shared", "email-attachments"), { recursive: true });
    fs.cpSync(brandingSource, path.join(instance.baseDir, "shared", "branding"), { recursive: true });

    const roleExists = run("sudo", ["-u", "postgres", "psql", "-tAc", `SELECT 1 FROM pg_roles WHERE rolname='${databaseRole}'`], { capture: true });
    if (roleExists) throw new Error(`Role PostgreSQL ja existe: ${databaseRole}`);
    run("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", `CREATE ROLE ${sqlIdentifier(databaseRole)} LOGIN PASSWORD '${databasePassword}'`]);
    roleCreated = true;
    run("sudo", ["-u", "postgres", "createdb", "--owner", databaseRole, databaseName]);
    databaseCreated = true;

    const databaseUrl = `postgresql://${databaseRole}:${encodeURIComponent(databasePassword)}@127.0.0.1:5432/${databaseName}`;
    const runtimeEnv = [
      "NODE_ENV=production",
      `PORT=${instance.backendPort}`,
      "BIND_HOST=127.0.0.1",
      "DATA_STORE=postgres",
      `DATABASE_URL=${databaseUrl}`,
      `JWT_SECRET=${runtimeSecret}`,
      `INTEGRATION_SECRET_KEY=${randomSecret(48)}`,
      `TWO_FACTOR_SECRET_KEY=${randomSecret(48)}`,
      `TWO_FACTOR_RECOVERY_PEPPER=${randomSecret(48)}`,
      `CINE_LOCAL_SECRET_FILE=${instance.baseDir}/shared/.local-secret`,
      `CINE_UPLOADS_DIR=${instance.baseDir}/shared/uploads`,
      `CINE_EMAIL_ATTACHMENTS_DIR=${instance.baseDir}/shared/email-attachments`,
      `FRONTEND_URL=${instance.siteUrl}`,
      `NEXT_PUBLIC_SITE_URL=${instance.siteUrl}`,
      `NEXT_PUBLIC_BASE_PATH=${instance.route}`,
      `NEXT_BASE_PATH=${instance.route}`,
      `APP_BASE_PATH=${instance.route}`,
      `CORS_ORIGIN=${publicOrigin(instance.siteUrl)}`,
      `CORS_ALLOWED_ORIGIN=${publicOrigin(instance.siteUrl)}`,
      "PAYMENTS_MODE=test",
      `ADMIN_EMAIL=${adminEmail}`,
      `ADMIN_PASSWORD=${adminPassword}`,
      "",
    ].join("\n");
    writePrivate(path.join(instance.baseDir, "shared", "backend.runtime.env"), runtimeEnv);
    writePrivate(path.join(instance.baseDir, "shared", "backend.env.local"), "# Credenciais exclusivas opcionais desta demonstracao.\n");
    writePrivate(path.join(instance.baseDir, "shared", "demo-admin.txt"), `cinema=${instance.name}\nurl=${instance.siteUrl}/admin\nemail=${adminEmail}\npassword=${adminPassword}\n`);
    fs.writeFileSync(path.join(instance.baseDir, "ecosystem.config.cjs"), ecosystem(instance), "utf8");

    const targetEnv = { ...process.env, DATABASE_URL: databaseUrl, POSTGRES_URL: databaseUrl };
    run("node", [path.join(currentRoot, "scripts", "db-migrate.js")], { cwd: currentRoot, env: targetEnv });
    run("node", [path.join(currentRoot, "scripts", "seed-demo-instance.mjs")], {
      cwd: currentRoot,
      env: {
        ...targetEnv,
        SOURCE_DATABASE_URL: sourceEnv.DATABASE_URL,
        DEMO_CINEMA_NAME: instance.name,
        DEMO_CINEMA_CITY: instance.city,
        DEMO_INSTAGRAM: instance.instagram,
        DEMO_ADMIN_NAME: `Administrador ${instance.name}`,
        DEMO_ADMIN_EMAIL: adminEmail,
        DEMO_ADMIN_PASSWORD: adminPassword,
        DEMO_SLUG: instance.slug,
        SOURCE_UPLOADS_DIR: path.join(sourceBase, "shared", "uploads"),
        TARGET_UPLOADS_DIR: path.join(instance.baseDir, "shared", "uploads"),
      },
    });
    const sourceRelease = fs.readFileSync(path.join(sourceBase, "current-release"), "utf8").trim();
    writePrivate(path.join(instance.baseDir, "shared", ".bootstrap-ready"), `created_at=${new Date().toISOString()}\nsource_release=${sourceRelease}\n`);
    console.log(`BOOTSTRAP_OK=${instance.slug};DATABASE=${databaseName}`);
  } catch (error) {
    if (databaseCreated) run("sudo", ["-u", "postgres", "dropdb", "--if-exists", databaseName]);
    if (roleCreated) run("sudo", ["-u", "postgres", "dropuser", "--if-exists", databaseRole]);
    fs.rmSync(instance.baseDir, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`BOOTSTRAP_ERROR: ${error.message}`);
  process.exit(1);
});
