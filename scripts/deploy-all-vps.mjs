#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadRegistry } from "./cinema-instance-registry.mjs";

const { Client } = pg;

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

export function assertStudioScope(sourceDir, instances) {
  const retiredPaths = [
    "backend/services/canva-studio/index.js",
    "backend/public/canva-studio.js",
    "backend/public/canva-studio.css",
    "backend/db/migrations/043_canva_studio.sql",
    "backend/db/migrations/044_canva_studio_mcp.sql",
    "public/images/cine-cruzeiro-signature-light.png",
    "public/images/cine-cruzeiro-signature-dark.png",
    "backend/public/creative-prompt-studio.js",
    "backend/services/creativePromptStudioService.js",
  ];
  const found = retiredPaths.filter((relativePath) => fs.existsSync(path.join(sourceDir, relativePath)));
  if (found.length) {
    throw new Error(`Deploy interrompido: a fonte ainda contem um Studio aposentado (${found.join(", ")}).`);
  }
  if (!instances.every((instance) => instance.slug && instance.siteUrl && instance.baseDir)) {
    throw new Error("Deploy interrompido: uma instancia do Studio nao possui configuracao completa.");
  }
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

function writeReleaseManifest(releaseDir, releaseInfo) {
  const manifestPath = path.join(releaseDir, "release-info.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(releaseInfo, null, 2)}\n`, "utf8");
  const written = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (written.commit !== releaseInfo.commit || written.release !== releaseInfo.release) {
    throw new Error(`Manifesto da release não persistiu corretamente: ${manifestPath}`);
  }
}

function materializeRelease(archivePath, instance, tag, env, releaseInfo) {
  const releaseDir = path.join(instance.baseDir, "releases", tag);
  if (fs.existsSync(releaseDir)) fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  run("tar", ["-xf", archivePath, "-C", releaseDir]);
  writeReleaseManifest(releaseDir, releaseInfo);

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
  writeReleaseManifest(releaseDir, releaseInfo);
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

function currentRelease(instance) {
  try {
    return fs.realpathSync(path.join(instance.baseDir, "current"));
  } catch {
    return "";
  }
}

function releaseVersion(releaseDir) {
  if (!releaseDir) return "";
  try {
    return JSON.parse(fs.readFileSync(path.join(releaseDir, "release-info.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function reloadAndCheck(instance, env) {
  const ecosystem = path.join(instance.baseDir, "ecosystem.config.cjs");
  // Deploys may replace the `current` symlink. PM2 must never inherit that
  // transient directory as its working directory or Node can fail with uv_cwd.
  const options = { env, cwd: instance.baseDir };
  run("pm2", ["startOrReload", ecosystem, "--only", instance.backendProcess, "--update-env"], options);
  run("pm2", ["startOrReload", ecosystem, "--only", instance.frontendProcess, "--update-env"], options);
  let lastError;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = spawnSync("curl", ["--silent", "--show-error", "--max-time", "10", "--output", "/dev/null", "--write-out", "%{http_code}", `${instance.siteUrl}/api/health/ready`], {
      stdio: ["ignore", "pipe", "ignore"], encoding: "utf8"
    });
    lastStatus = Number(String(response.stdout || "").trim()) || 0;
    if (response.status === 0 && lastStatus >= 200 && lastStatus < 300) return;
    lastError = `checagem de disponibilidade falhou na tentativa ${attempt}/12 (HTTP ${lastStatus || "sem resposta"})`;
    run("sleep", ["5"]);
  }
  const error = new Error(`${instance.slug}: ${lastError}`);
  error.outageType = lastStatus === 503 ? "readiness_dependency_unavailable" : lastStatus >= 500 ? "http_server_error" : "health_check_unreachable";
  error.healthStatus = lastStatus;
  throw error;
}

export function releaseMetadata(sourceDir, commit, release, previousRelease) {
  const commitDetails = run("git", ["show", "-s", "--format=%s%n%b", commit], { cwd: sourceDir, capture: true });
  const [summary = "Atualização do sistema", ...body] = commitDetails.split(/\r?\n/);
  const description = [summary, body.join("\n").trim()].filter(Boolean).join("\n\n");
  const files = run("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", commit], { cwd: sourceDir, capture: true })
    .split(/\r?\n/).map((file) => file.trim()).filter(Boolean).slice(0, 200);
  const appVersion = JSON.parse(fs.readFileSync(path.join(sourceDir, "package.json"), "utf8")).version || "0.0.0";
  const commitShort = commit.slice(0, 7);
  return {
    appVersion,
    version: `${appVersion}+${commitShort}`,
    commit,
    commitShort,
    release,
    previousRelease: previousRelease || "",
    summary: description,
    files,
    deployedAt: new Date().toISOString()
  };
}

async function persistSystemLog(env, log) {
  const connectionString = env.DATABASE_URL || env.POSTGRES_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  try {
    await client.connect();
    await client.query(`INSERT INTO system_logs (level, category, event, message, metadata, created_at)
      VALUES ($1, 'deployment', $2, $3, $4::jsonb, now())`, [
      log.level,
      log.event,
      String(log.message || "").slice(0, 1200),
      JSON.stringify(log.metadata || {})
    ]);
  } catch (error) {
    console.error(`LOG_PERSIST_FAILED ${log.event}: ${String(error.message || error).slice(0, 400)}`);
  } finally {
    await client.end().catch(() => {});
  }
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

async function main() {
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
  let activeDeployment = null;
  try {
    // The command is commonly invoked through <instance>/current. Detach from
    // it before the symlink is atomically replaced later in this deployment.
    process.chdir(workDir);
    run("git", ["clone", "--quiet", registry.repository, sourceDir]);
    const targetCommit = args.commit || run("git", ["rev-parse", "HEAD"], { cwd: sourceDir, capture: true });
    run("git", ["checkout", "--quiet", targetCommit], { cwd: sourceDir });
    assertStudioScope(sourceDir, instances);
    const commit = run("git", ["rev-parse", "HEAD"], { cwd: sourceDir, capture: true });
    const tag = releaseTag(commit);
    run("git", ["archive", "--format=tar", "--output", archivePath, commit], { cwd: sourceDir });
    console.log(`Commit coordenado: ${commit}`);

    for (const instance of instances) {
      console.log(`\n=== Preparando ${instance.slug} ===`);
      activeDeployment = { instance, env: null, stage: "prepare_release" };
      ensureInstanceLayout(instance);
      const env = runtimeEnvironment(instance);
      const previous = currentRelease(instance);
      const info = releaseMetadata(sourceDir, commit, tag, previous ? path.basename(previous) : "");
      activeDeployment = { instance, env, stage: "release_build", previous, releaseInfo: info };
      const releaseDir = materializeRelease(archivePath, instance, tag, env, info);
      const item = { instance, env, releaseDir, previous, releaseInfo: info, stage: "prepared" };
      prepared.push(item);
      activeDeployment = null;
    }

    for (const item of prepared) {
      activeDeployment = item;
      console.log(`\n=== Publicando ${item.instance.slug} ===`);
      item.stage = "backup_and_migration";
      backupAndMigrate(item.instance, item.releaseDir, item.env);
      item.stage = "release_activation";
      switchCurrent(item.instance, item.releaseDir);
      switched.push(item);
      item.stage = "health_check";
      reloadAndCheck(item.instance, item.env);
      await persistSystemLog(item.env, {
        level: "info",
        event: "deployment.completed",
        message: item.releaseInfo.summary.split("\n")[0] || "Nova release ativada com sucesso.",
        metadata: {
          status: "completed",
          version: item.releaseInfo.version,
          appVersion: item.releaseInfo.appVersion,
          commit: item.releaseInfo.commit,
          commitShort: item.releaseInfo.commitShort,
          release: item.releaseInfo.release,
          previousRelease: item.releaseInfo.previousRelease,
          summary: item.releaseInfo.summary,
          files: item.releaseInfo.files,
          deployedAt: item.releaseInfo.deployedAt,
          siteUrl: item.instance.siteUrl,
          healthCheck: "passed"
        }
      });
      item.stage = "completed";
      activeDeployment = null;
    }

    for (const item of prepared) cleanupReleases(item.instance, registry.keepReleases);
    run("pm2", ["save"], { cwd: os.tmpdir() });
    console.log(`DEPLOY_ALL_OK=${commit};INSTANCES=${instances.length}`);
  } catch (error) {
    console.error(`DEPLOY_ALL_ERROR: ${error.message}`);
    const failed = activeDeployment;
    if (failed?.env) {
      const releaseInfo = failed.releaseInfo || {};
      const releaseWasSwitched = switched.includes(failed);
      const current = currentRelease(failed.instance);
      const errorMessage = String(error.message || error)
        .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, "[conexão do banco ocultada]")
        .slice(0, 1000);
      const metadata = {
        status: "failed",
        failureStage: failed.stage || "unknown",
        currentRelease: current ? path.basename(current) : "indisponível",
        attemptedRelease: releaseInfo.release || "",
        previousRelease: releaseInfo.previousRelease || "",
        currentVersion: releaseWasSwitched ? "rollback em andamento" : releaseVersion(current),
        attemptedVersion: releaseInfo.version || "",
        previousVersion: releaseVersion(failed.previous),
        attemptedCommit: releaseInfo.commit || "",
        errorType: error.name || "Error",
        errorCode: error.code || "DEPLOYMENT_FAILED",
        cause: errorMessage,
        healthStatus: error.healthStatus || 0,
        outageType: releaseWasSwitched ? error.outageType || "release_activation_failed" : "none",
        outageDetected: releaseWasSwitched,
        siteUrl: failed.instance.siteUrl
      };
      await persistSystemLog(failed.env, {
        level: "error",
        event: "deployment.failed",
        message: errorMessage,
        metadata
      });
      if (releaseWasSwitched) {
        await persistSystemLog(failed.env, {
          level: "error",
          event: "service.outage.detected",
          message: errorMessage,
          metadata: {
            outageType: metadata.outageType,
            cause: errorMessage,
            failureStage: failed.stage || "unknown",
            healthStatus: error.healthStatus || 0,
            attemptedRelease: releaseInfo.release || "",
            previousRelease: releaseInfo.previousRelease || "",
            currentVersion: releaseInfo.version || "",
            recovery: "O fluxo de deploy tentará retornar à release anterior."
          }
        });
      }
    }
    for (const item of switched.reverse()) {
      try {
        if (item.previous) {
          console.error(`Rollback de ${item.instance.slug} para ${item.previous}`);
          switchCurrent(item.instance, item.previous);
          reloadAndCheck(item.instance, item.env);
          await persistSystemLog(item.env, {
            level: "warn",
            event: "deployment.rollback_completed",
            message: "A publicação foi revertida para a versão anterior após uma falha de ativação.",
            metadata: {
              status: "rolled_back",
              failedRelease: item.releaseInfo.release,
              currentRelease: path.basename(item.previous),
              currentVersion: releaseVersion(item.previous),
              previousVersion: item.releaseInfo.version,
              failedCommit: item.releaseInfo.commit,
              recoveryHealthCheck: "passed"
            }
          });
        } else console.error(`Rollback de ${item.instance.slug} ignorado: não havia release anterior válida.`);
      } catch (rollbackError) {
        console.error(`ROLLBACK_ERROR ${item.instance.slug}: ${rollbackError.message}`);
        await persistSystemLog(item.env, {
          level: "error",
          event: "service.outage.recovery_failed",
          message: String(rollbackError.message || rollbackError).slice(0, 1000),
          metadata: {
            outageType: "rollback_health_check_failed",
            cause: String(rollbackError.message || rollbackError).slice(0, 1000),
            attemptedRelease: item.releaseInfo.release,
            previousRelease: item.previous ? path.basename(item.previous) : "",
            errorType: rollbackError.name || "Error",
            healthStatus: rollbackError.healthStatus || 0
          }
        });
      }
    }
    // Keep prepared releases on a failed deploy. They are useful for recovery
    // and must not remove the only runnable build for an active process.
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
  main().catch((error) => {
    console.error(`DEPLOY_ALL_ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
