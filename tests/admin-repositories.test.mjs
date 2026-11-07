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
  const assetPaths = fs.readFileSync(path.join(root, "backend", "services", "publicAssetPathService.js"), "utf8");
  assert.match(server, /createPublicAssetPathService\(/);
  assert.match(assetPaths, /CINE_PUBLIC_BACKEND_URL \|\| env\.FRONTEND_URL/);
  assert.match(assetPaths, /new URL\(publicUrl\)\.pathname/);
});

test("rotas migradas nao entram no advisory lock global", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  assert.match(server, /repositoryMutationRoute\(pathname, method\)/);
  assert.match(server, /!targetedRepositoryMutation && !selfManagedOrderDeletion && !selfManagedPermanentOrderDeletion && !selfManagedConcessionArchive && !selfManagedTicketValidation && !selfManagedClubAssignment && !selfManagedBoxOfficeSale && !selfManagedPointCancellation && !selfManagedRefundFlow && !context\?\.adminMutationLocked/);
  assert.match(server, /selfManagedOrderDeletion = method === "DELETE" &&/);
  assert.match(server, /selfManagedPermanentOrderDeletion = method === "DELETE" &&/);
  assert.match(server, /selfManagedClubAssignment = method === "POST" && pathname === "\/api\/admin\/subscriptions\/assign"/);
  assert.match(server, /selfManagedTicketValidation = method === "POST" && pathname === "\/api\/tickets\/validate"/);
  assert.match(server, /selfManagedBoxOfficeSale = method === "POST" &&/);
  assert.match(server, /selfManagedPointCancellation = method === "POST" &&/);
  assert.match(server, /selfManagedRefundFlow = method === "POST" &&/);
  const routeSources = [
    server,
    ...["movieCatalogHandler.js", "venueConfigurationHandler.js", "commercialCatalogHandler.js"]
      .map((file) => fs.readFileSync(path.join(root, "backend", "services", file), "utf8"))
  ].join("\n");
  ["movieRepository", "sessionRepository", "roomRepository", "ticketTypeRepository", "promotionRepository", "concessionRepository", "settingsRepository", "userRepository", "orderRepository"].forEach((repository) => {
    assert.match(routeSources, new RegExp(`${repository}\\.`));
  });
});

test("painel atualiza os quatro dominios sem recarregar todo o conteudo", () => {
  const admin = fs.readFileSync(path.join(root, "backend", "public", "admin.js"), "utf8");
  const moduleSource = (file) => fs.readFileSync(path.join(root, "backend", "public", "admin-modules", file), "utf8");
  assert.match(admin, /function upsertAdminCollection/);
  assert.match(admin, /function applySessionMutation/);
  assert.match(moduleSource("movie-catalog-commands.js"), /upsertAdminCollection\("movies", saved\)/);
  assert.match(moduleSource("room-list-view.js"), /upsertAdminCollection\("rooms", saved\)/);
  assert.match(moduleSource("ticket-catalog-view.js"), /upsertAdminCollection\("ticketTypes", saved\)/);
  assert.match(moduleSource("concession-products-view.js"), /upsertAdminCollection\("concessions", saved\)/);
  assert.match(moduleSource("promotions-view.js"), /upsertAdminCollection\("promotions", saved\)/);
  assert.match(moduleSource("team-accounts-view.js"), /upsertAdminCollection\("users", saved\)/);
  assert.match(moduleSource("customer-accounts-view.js"), /upsertAdminCollection\("users", saved\)/);
});
