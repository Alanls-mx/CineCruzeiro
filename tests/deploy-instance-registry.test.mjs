import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateRegistry } from "../scripts/cinema-instance-registry.mjs";
import { postgresEnvironment } from "../scripts/deploy-all-vps.mjs";

function instance(overrides = {}) {
  return {
    slug: "cinema-teste",
    enabled: true,
    brandFrom: "Cine Cruzeiro",
    name: "Cinema Teste",
    city: "Teste - SP",
    instagram: "@cinemateste",
    route: "/projects/cinema-teste",
    siteUrl: "https://lumixengine.com/projects/cinema-teste",
    baseDir: "/home/ubuntu/projects/cinema-teste",
    frontendPort: 3190,
    backendPort: 4190,
    frontendProcess: "cinema-teste-frontend",
    backendProcess: "cinema-teste-backend",
    applyBrand: true,
    ...overrides,
  };
}

test("valida uma instalacao independente", () => {
  const registry = validateRegistry({
    schemaVersion: 1,
    repository: "https://github.com/example/cinema.git",
    keepReleases: 2,
    instances: [instance()],
  });
  assert.equal(registry.instances[0].route, "/projects/cinema-teste");
  assert.equal(registry.instances[0].backendPort, 4190);
});

test("rejeita portas compartilhadas entre frontend e backend de cinemas diferentes", () => {
  assert.throws(() => validateRegistry({
    schemaVersion: 1,
    repository: "https://github.com/example/cinema.git",
    instances: [
      instance(),
      instance({
        slug: "outro-cinema",
        name: "Outro Cinema",
        route: "/projects/outro-cinema",
        siteUrl: "https://lumixengine.com/projects/outro-cinema",
        baseDir: "/home/ubuntu/projects/outro-cinema",
        frontendPort: 4190,
        backendPort: 4290,
        frontendProcess: "outro-cinema-frontend",
        backendProcess: "outro-cinema-backend",
      }),
    ],
  }), /Porta duplicada/);
});

test("rejeita siteUrl que nao corresponde a rota publica", () => {
  assert.throws(() => validateRegistry({
    schemaVersion: 1,
    repository: "https://github.com/example/cinema.git",
    instances: [instance({ siteUrl: "https://lumixengine.com/projects/outra-rota" })],
  }), /siteUrl deve terminar/);
});

test("converte DATABASE_URL sem colocar credenciais nos argumentos do pg_dump", () => {
  const env = postgresEnvironment("postgresql://cinema:senha%20forte@127.0.0.1:5433/cinema_demo?sslmode=require", { KEEP: "yes" });
  assert.equal(env.PGHOST, "127.0.0.1");
  assert.equal(env.PGPORT, "5433");
  assert.equal(env.PGUSER, "cinema");
  assert.equal(env.PGPASSWORD, "senha forte");
  assert.equal(env.PGDATABASE, "cinema_demo");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(env.KEEP, "yes");
});

test("aplica marca apenas nos arquivos operacionais e sobrepoe recursos aprovados", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cinema-brand-test-"));
  try {
    fs.mkdirSync(path.join(temp, "src"), { recursive: true });
    fs.mkdirSync(path.join(temp, "backend"), { recursive: true });
    fs.mkdirSync(path.join(temp, "tests"), { recursive: true });
    fs.mkdirSync(path.join(temp, "branding", "public", "images"), { recursive: true });
    fs.writeFileSync(path.join(temp, "src", "brand.ts"), 'export const brand = "Cine Cruzeiro /projects/cinecruzeiro";');
    fs.writeFileSync(path.join(temp, "backend", "brand.js"), 'module.exports = "Cine Cruzeiro";');
    fs.writeFileSync(path.join(temp, "tests", "history.txt"), "Cine Cruzeiro");
    fs.writeFileSync(path.join(temp, "branding", "public", "images", "logo-display.webp"), "demo-logo");

    const script = path.resolve("scripts/apply-instance-brand.mjs");
    const result = spawnSync(process.execPath, [
      script,
      "--root", temp,
      "--old-name", "Cine Cruzeiro",
      "--name", "Cinema Teste",
      "--route", "/projects/cinema-teste",
      "--branding-dir", path.join(temp, "branding"),
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(path.join(temp, "src", "brand.ts"), "utf8"), /Cinema Teste \/projects\/cinema-teste/);
    assert.equal(fs.readFileSync(path.join(temp, "tests", "history.txt"), "utf8"), "Cine Cruzeiro");
    assert.equal(fs.readFileSync(path.join(temp, "public", "images", "logo-display.webp"), "utf8"), "demo-logo");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
