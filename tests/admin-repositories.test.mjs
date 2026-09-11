import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryDir = path.join(root, "backend", "repositories");

function source(name) {
  return fs.readFileSync(path.join(repositoryDir, name), "utf8");
}

test("repositories da primeira fase usam SQL direcionado", () => {
  const files = ["movieRepository.js", "sessionRepository.js", "roomRepository.js", "ticketTypeRepository.js"];
  files.forEach((file) => assert.ok(fs.existsSync(path.join(repositoryDir, file)), `${file} ausente`));
  const sql = files.map(source).join("\n");
  ["users", "orders", "payments", "tickets", "movies", "rooms", "ticket_types", "sessions"].forEach((table) => {
    assert.doesNotMatch(sql, new RegExp(`DELETE\\s+FROM\\s+${table}\\s*;`, "i"), `delete integral detectado em ${table}`);
  });
  assert.match(source("movieRepository.js"), /UPDATE movies SET/);
  assert.match(source("sessionRepository.js"), /UPDATE sessions SET/);
  assert.match(source("roomRepository.js"), /UPDATE sessions SET room_id/);
  assert.match(source("ticketTypeRepository.js"), /sessions\.reprice/);
});

test("repositories da segunda fase usam SQL direcionado e campos permitidos", () => {
  const files = ["promotionRepository.js", "concessionRepository.js", "settingsRepository.js", "userRepository.js"];
  files.forEach((file) => assert.ok(fs.existsSync(path.join(repositoryDir, file)), `${file} ausente`));
  const sql = files.map(source).join("\n");
  ["users", "orders", "payments", "tickets", "movies", "rooms", "ticket_types", "sessions", "promotions", "concessions"].forEach((table) => {
    assert.doesNotMatch(sql, new RegExp(`DELETE\\s+FROM\\s+${table}\\s*;`, "i"), `delete integral detectado em ${table}`);
  });
  assert.match(source("promotionRepository.js"), /UPDATE promotions SET/);
  assert.match(source("concessionRepository.js"), /available\+\$2 >= 0/);
  assert.match(source("concessionRepository.js"), /CONCESSION_INVENTORY_CHANGED/);
  assert.match(source("settingsRepository.js"), /jsonb_set/);
  assert.match(source("userRepository.js"), /FIELD_COLUMNS/);
  assert.match(source("userRepository.js"), /session_version=session_version\+1/);
  assert.match(source("userRepository.js"), /ORDER BY id FOR UPDATE/);
  assert.doesNotMatch(source("userRepository.js"), /email.*OR google_sub/i);
});

test("repository de pedidos usa SQL direcionado e idempotente", () => {
  const file = "orderRepository.js";
  assert.ok(fs.existsSync(path.join(repositoryDir, file)), `${file} ausente`);
  const sql = source(file);
  ["orders", "payments", "tickets", "movies", "users"].forEach((table) => {
    assert.doesNotMatch(sql, new RegExp(`DELETE\\s+FROM\\s+${table}\\s*;`, "i"), `delete integral detectado em ${table}`);
  });
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.match(sql, /WHERE order_id = \$1/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /ORDER_CHANGED/);
});

test("backend deriva o base path publico para imagens fora do Next", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  assert.match(server, /CINE_PUBLIC_BACKEND_URL \|\| process\.env\.FRONTEND_URL/);
  assert.match(server, /new URL\(publicUrl\)\.pathname/);
});

test("rotas migradas nao entram no advisory lock global", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  assert.match(server, /repositoryMutationRoute\(pathname, method\)/);
  assert.match(server, /!targetedRepositoryMutation && !context\?\.adminMutationLocked/);
  ["movieRepository", "sessionRepository", "roomRepository", "ticketTypeRepository", "promotionRepository", "concessionRepository", "settingsRepository", "userRepository", "orderRepository"].forEach((repository) => {
    assert.match(server, new RegExp(`${repository}\\.`));
  });
});

test("painel atualiza os quatro dominios sem recarregar todo o conteudo", () => {
  const admin = fs.readFileSync(path.join(root, "backend", "public", "admin.js"), "utf8");
  assert.match(admin, /function upsertAdminCollection/);
  assert.match(admin, /function applySessionMutation/);
  assert.match(admin, /upsertAdminCollection\("movies", saved\)/);
  assert.match(admin, /upsertAdminCollection\("rooms", saved\)/);
  assert.match(admin, /upsertAdminCollection\("ticketTypes", saved\)/);
  assert.match(admin, /upsertAdminCollection\("concessions", saved\)/);
  assert.match(admin, /upsertAdminCollection\("promotions", saved\)/);
  assert.match(admin, /upsertAdminCollection\("users", saved\)/);
});
