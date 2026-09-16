#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
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
  if (result.status !== 0) {
    const detail = options.capture ? String(result.stderr || result.stdout || "").trim() : "";
    throw new Error(`${command} falhou com codigo ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return options.capture ? String(result.stdout || "").trim() : "";
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function runtimeEnvironment(instance) {
  const shared = path.join(instance.baseDir, "shared");
  const runtime = parseEnvFile(path.join(shared, "backend.runtime.env"));
  const local = parseEnvFile(path.join(shared, "backend.env.local"));
  const env = { ...process.env, ...runtime, ...local };
  if (!env.DATABASE_URL && !env.POSTGRES_URL) throw new Error(`${instance.slug}: DATABASE_URL ausente.`);
  return env;
}

export function postgresEnvironment(databaseUrl, env = {}) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL precisa usar o formato postgresql://usuario:senha@host:porta/banco.");
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) throw new Error("DATABASE_URL nao e uma URL PostgreSQL.");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !parsed.username || !database) throw new Error("DATABASE_URL PostgreSQL incompleta.");
  const pgEnv = {
    ...env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: database,
  };
  const sslMode = parsed.searchParams.get("sslmode");
  if (sslMode) pgEnv.PGSSLMODE = sslMode;
  return pgEnv;
}

function ensureInstanceLayout(instance) {
  const required = [instance.baseDir, path.join(instance.baseDir, "shared"), path.join(instance.baseDir, "releases")];
  for (const directory of required) {
    if (!fs.existsSync(directory)) throw new Error(`${instance.slug}: diretorio ausente: ${directory}`);
  }
  const ecosystem = path.join(instance.baseDir, "ecosystem.config.cjs");
  if (!fs.existsSync(ecosystem)) throw new Error(`${instance.slug}: ecosystem.config.cjs ausente.`);
  if (instance.applyBrand) {
    const brandingImages = path.join(instance.baseDir, "shared", "branding", "public", "images");
    const requiredBrandAssets = ["logo-display.webp", "logo-header-compact.webp", "logo-pdf.jpg"];
    for (const asset of requiredBrandAssets) {
      if (!fs.existsSync(path.join(brandingImages, asset))) {
        throw new Error(`${instance.slug}: identidade incompleta; falta shared/branding/public/images/${asset}.`);
      }
    }
  }
}

function releaseTag(commit) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  return `${stamp}-${commit.slice(0, 7)}`;
}

function materializeRelease(archivePath, instance, tag, env) {
  const releaseDir = path.join(instance.baseDir, "releases", tag);
  if (fs.existsSync(releaseDir)) fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  run("tar", ["-xf", archivePath, "-C", releaseDir]);

  if (instance.applyBrand) {
    const brandingDir = path.join(instance.baseDir, "shared", "branding");
    run("node", [
      path.join(releaseDir, "scripts", "apply-instance-brand.mjs"),
      "--root", releaseDir,
      "--old-name", instance.brandFrom,
      "--name", instance.name,
      "--route", instance.route,
      "--city", instance.city,
      "--instagram", instance.instagram,
      "--branding-dir", brandingDir,
    ], { cwd: releaseDir, env });
  }

  run("npm", ["ci", "--include=dev", "--silent"], { cwd: releaseDir, env });
  run("npm", ["run", "lint"], { cwd: releaseDir, env });
  const buildEnv = {
    ...env,
    NODE_ENV: "production",
    NEXT_PUBLIC_BASE_PATH: instance.route,
    NEXT_BASE_PATH: instance.route,
    NEXT_PUBLIC_CINEMA_SLUG: instance.slug,
    NEXT_PUBLIC_SITE_URL: instance.siteUrl,
    CINE_BACKEND_URL: `http://127.0.0.1:${instance.backendPort}`,
    NEXT_PUBLIC_CINE_API_URL: instance.siteUrl,
  };
  run("npm", ["run", "build"], { cwd: releaseDir, env: buildEnv });
  return releaseDir;
}

function backupAndMigrate(instance, releaseDir, env) {
  const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL;
  const backupDir = path.join(instance.baseDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backup = path.join(backupDir, `${instance.slug}-${stamp}-pre-deploy.dump`);
  try {
    run("pg_dump", ["--format=custom", "--file", backup], { env: postgresEnvironment(databaseUrl, env) });
    if (!fs.statSync(backup).size) throw new Error(`${instance.slug}: backup vazio.`);
  } catch (error) {
    fs.rmSync(backup, { force: true });
    throw error;
  }
  run("npm", ["run", "db:migrate"], { cwd: releaseDir, env: { ...env, DATABASE_URL: databaseUrl } });
}

function switchCurrent(instance, releaseDir) {
  const current = path.join(instance.baseDir, "current");
  const temporary = path.join(instance.baseDir, `current-${process.pid}.tmp`);
  fs.rmSync(temporary, { force: true });
  fs.symlinkSync(releaseDir, temporary);
  fs.renameSync(temporary, current);
  fs.writeFileSync(path.join(instance.baseDir, "current-release"), `${path.basename(releaseDir)}\n`, "utf8");
}

function reloadAndCheck(instance, env) {
  const ecosystem = path.join(instance.baseDir, "ecosystem.config.cjs");
  run("pm2", ["startOrReload", ecosystem, "--only", instance.backendProcess, "--update-env"], { env });
  run("pm2", ["startOrReload", ecosystem, "--only", instance.frontendProcess, "--update-env"], { env });
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = spawnSync("curl", ["--fail", "--silent", "--show-error", "--max-time", "10", `${instance.siteUrl}/api/health/ready`], {
      stdio: "ignore",
    });
    if (response.status === 0) return;
    lastError = `health check falhou (tentativa ${attempt}/12)`;
    run("sleep", ["5"]);
  }
  throw new Error(`${instance.slug}: ${lastError}`);
}

function cleanupReleases(instance, keepReleases) {
  const releasesDir = path.join(instance.baseDir, "releases");
  const current = fs.realpathSync(path.join(instance.baseDir, "current"));
  const directories = fs.readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const target = path.join(releasesDir, entry.name);
      return { target, mtime: fs.statSync(target).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  const retained = new Set(directories.slice(0, keepReleases).map((entry) => entry.target));
  retained.add(current);
  for (const entry of directories) {
    if (!retained.has(entry.target)) fs.rmSync(entry.target, { recursive: true, force: true });
  }
}

function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = { commit: "", only: "", dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--only") parsed.only = args[++index] || "";
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (!parsed.commit) parsed.commit = arg;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return parsed;
}

function main() {
  if (process.platform !== "linux") throw new Error("Este deploy deve ser executado na VPS Linux.");
  const args = parseArguments();
  const registryPath = process.env.CINEMA_INSTANCES_FILE || "/home/ubuntu/projects/cinema-instances.json";
  const registry = loadRegistry(registryPath);
  let instances = registry.instances.filter((instance) => instance.enabled);
  if (args.only) instances = instances.filter((instance) => instance.slug === args.only);
  if (!instances.length) throw new Error("Nenhuma instalacao habilitada corresponde ao deploy.");

  console.log(`Instalacoes: ${instances.map((instance) => instance.slug).join(", ")}`);
  if (args.dryRun) {
    console.log(`DRY_RUN_OK=${instances.length}`);
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cinema-deploy-"));
  const sourceDir = path.join(workDir, "source");
  const archivePath = path.join(workDir, "source.tar");
  const prepared = [];
  const switched = [];
  try {
    run("git", ["clone", "--quiet", registry.repository, sourceDir]);
    const targetCommit = args.commit || run("git", ["rev-parse", "HEAD"], { cwd: sourceDir, capture: true });
    run("git", ["checkout", "--quiet", targetCommit], { cwd: sourceDir });
    const commit = run("git", ["rev-parse", "HEAD"], { cwd: sourceDir, capture: true });
    const tag = releaseTag(commit);
    run("git", ["archive", "--format=tar", "--output", archivePath, commit], { cwd: sourceDir });
    console.log(`Commit coordenado: ${commit}`);

    for (const instance of instances) {
      console.log(`\n=== Preparando ${instance.slug} ===`);
      ensureInstanceLayout(instance);
      const env = runtimeEnvironment(instance);
      const releaseDir = materializeRelease(archivePath, instance, tag, env);
      const currentPath = path.join(instance.baseDir, "current");
      const previous = fs.existsSync(currentPath) ? fs.realpathSync(currentPath) : "";
      prepared.push({ instance, env, releaseDir, previous });
    }

    for (const item of prepared) {
      console.log(`\n=== Publicando ${item.instance.slug} ===`);
      backupAndMigrate(item.instance, item.releaseDir, item.env);
      switchCurrent(item.instance, item.releaseDir);
      switched.push(item);
      reloadAndCheck(item.instance, item.env);
    }

    for (const item of prepared) cleanupReleases(item.instance, registry.keepReleases);
    run("pm2", ["save"]);
    console.log(`DEPLOY_ALL_OK=${commit};INSTANCES=${instances.length}`);
  } catch (error) {
    console.error(`DEPLOY_ALL_ERROR: ${error.message}`);
    for (const item of switched.reverse()) {
      try {
        if (item.previous) {
          console.error(`Rollback de ${item.instance.slug} para ${item.previous}`);
          switchCurrent(item.instance, item.previous);
          reloadAndCheck(item.instance, item.env);
        } else {
          console.error(`Rollback da primeira publicacao de ${item.instance.slug}`);
          fs.rmSync(path.join(item.instance.baseDir, "current"), { force: true });
          spawnSync("pm2", ["delete", item.instance.backendProcess], { stdio: "ignore" });
          spawnSync("pm2", ["delete", item.instance.frontendProcess], { stdio: "ignore" });
        }
      } catch (rollbackError) {
        console.error(`ROLLBACK_ERROR ${item.instance.slug}: ${rollbackError.message}`);
      }
    }
    for (const item of prepared) {
      try {
        const currentPath = path.join(item.instance.baseDir, "current");
        const current = fs.existsSync(currentPath) ? fs.realpathSync(currentPath) : "";
        if (path.resolve(item.releaseDir) !== path.resolve(current)) {
          fs.rmSync(item.releaseDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error(`CLEANUP_ERROR ${item.instance.slug}: ${cleanupError.message}`);
      }
    }
    process.exitCode = 1;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

const isCli = (() => {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(`DEPLOY_ALL_ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
