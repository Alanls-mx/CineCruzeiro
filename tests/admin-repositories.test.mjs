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

test("rotas migradas nao entram no advisory lock global", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  assert.match(server, /repositoryMutationRoute\(pathname, method\)/);
  assert.match(server, /!targetedRepositoryMutation && !context\?\.adminMutationLocked/);
  ["movieRepository", "sessionRepository", "roomRepository", "ticketTypeRepository"].forEach((repository) => {
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
});
