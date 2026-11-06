import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import integrationConfigService from "../backend/services/integrationConfigService.js";
import presenterService from "../backend/services/commercialCatalogPresenter.js";
import accessPolicy from "../backend/services/commercialCatalogAccessPolicy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("politica de acesso do catalogo exige token exato e origem explicitamente permitida", () => {
  assert.equal(accessPolicy.isCommercialCatalogRequest({ url: "/api/commercial/catalog?token=old" }), true);
  assert.equal(accessPolicy.isCommercialCatalogRequest({ url: "/api/admin/content" }), false);
  assert.equal(accessPolicy.catalogTokensMatch("", ""), false);
  assert.equal(accessPolicy.catalogTokensMatch("secret", "secret"), true);
  assert.equal(accessPolicy.catalogTokensMatch("secret", "secret-extra"), false);
  assert.equal(accessPolicy.commercialCatalogToken({ url: "/api/commercial/catalog?token=query", headers: { authorization: "Bearer header", "x-commercial-catalog-token": "alternate" } }), "header");
  assert.equal(accessPolicy.commercialCatalogToken({ url: "/api/commercial/catalog?token=query", headers: {} }), "query");
  const config = { allowedOrigins: "https://partner.example.test" };
  assert.equal(accessPolicy.commercialCatalogCorsHeaders({ headers: { origin: "https://partner.example.test" } }, config)["Access-Control-Allow-Origin"], "https://partner.example.test");
  assert.deepEqual(accessPolicy.commercialCatalogCorsHeaders({ headers: { origin: "https://other.example.test" } }, config), {});
});

test("catálogo comercial externo salva token criptografado e não o devolve ao painel", () => {
  const originalSecret = process.env.INTEGRATION_SECRET_KEY;
  process.env.INTEGRATION_SECRET_KEY = "commercial-catalog-test-secret";
  try {
    const db = { settings: {}, integrations: {}, auditLogs: [] };
    const saved = integrationConfigService.save(db, "commercialCatalog", {
      accessToken: "catalog_test_1234567890",
      allowedOrigins: "https://app.parceira.example",
      cacheSeconds: 90
    }, { id: "admin-test" });

    assert.equal(saved.configured, true);
    assert.equal(saved.secrets.accessToken.hasValue, true);
    assert.equal(saved.values.allowedOrigins, "https://app.parceira.example");
    assert.equal(saved.values.cacheSeconds, 90);
    assert.equal(saved.values.accessToken, undefined);
    assert.equal(db.integrations.commercialCatalog.accessToken.encrypted, true);
    assert.equal(integrationConfigService.resolvedConfig(db, "commercialCatalog").accessToken, "catalog_test_1234567890");
  } finally {
    if (originalSecret === undefined) delete process.env.INTEGRATION_SECRET_KEY;
    else process.env.INTEGRATION_SECRET_KEY = originalSecret;
  }
});

test("catálogo comercial possui endpoint protegido, CORS opcional e os conjuntos comerciais esperados", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const presenter = fs.readFileSync(path.join(root, "backend", "services", "commercialCatalogPresenter.js"), "utf8");
  const admin = fs.readFileSync(path.join(root, "backend", "public", "admin-modules", "integration-administration.js"), "utf8");

  assert.match(server, /pathname === "\/api\/commercial\/catalog"/);
  assert.match(server, /catalogTokensMatch/);
  assert.match(server, /commercialCatalogCorsHeaders/);
  assert.match(server, /commercialCatalog\/access-token/);
  assert.match(server, /createCommercialCatalogPresenter/);
  assert.match(presenter, /availableSessions/);
  assert.match(presenter, /concessions:/);
  assert.match(presenter, /promotions:/);
  assert.match(presenter, /coupons:/);
  assert.match(presenter, /dates/);
  assert.match(admin, /Gerar token seguro/);
  assert.match(admin, /Revelar token/);
  assert.match(admin, /Copiar token/);
  assert.match(admin, /Authorization: Bearer TOKEN/);
});

test("catálogo comercial preserva sessões, ofertas e identidade da instalação", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const { buildCommercialCatalog } = presenterService.createCommercialCatalogPresenter({
    appFrontendUrl: () => "https://cinema.example",
    isSessionSellable: (session) => session.id === "session-1",
    normalizedSessionStatus: (session) => session.status || "scheduled",
    publicAssetUrl: (url) => url,
    publicSessionStatus: () => "available",
    roomDisplayLabel: (room) => room?.name || "",
    roomForSession: (db, session) => db.rooms.find((room) => room.id === session.roomId),
    sessionSalesOpenAt: () => now,
    sessionStartsAt: (session) => new Date(`${session.date}T18:00:00.000Z`),
    ticketTypesForSession: (db) => db.ticketTypes,
    todayIsoDate: () => "2026-10-11"
  });
  const catalog = buildCommercialCatalog({
    settings: { cinemaName: "Cinema de Teste" },
    rooms: [{ id: "room-1", name: "Sala 1" }],
    ticketTypes: [{ id: "full", name: "Inteira", price: 10 }],
    movies: [
      { id: "movie-1", title: "Filme A", posterUrl: "/poster.webp", artworkMetadata: { containsTitle: true, privateCanary: "internal-only", poster: { dominantAsset: "logo", privateCanary: "nested-internal" } }, sessions: [
        { id: "session-1", roomId: "room-1", date: "2026-10-12", time: "15:00" },
        { id: "session-2", roomId: "room-1", date: "2026-10-12", time: "18:00" }
      ] },
      { id: "hidden", title: "Oculto", status: "hidden", sessions: [] }
    ],
    concessions: [{ id: "popcorn", name: "Pipoca", price: 20, imageUrl: "/popcorn.webp" }],
    promotions: [
      { id: "promo", name: "Oferta", active: true },
      { id: "coupon", name: "Cupom", couponCode: "CINEMA" },
      { id: "expired", name: "Antiga", endsAt: "2026-10-10T00:00:00.000Z" }
    ]
  }, now);

  assert.equal(catalog.catalog.name, "Cinema de Teste");
  assert.equal(catalog.catalog.programmingUrl, "https://cinema.example/filmes");
  assert.deepEqual(catalog.movies.map((movie) => movie.id), ["movie-1"]);
  assert.equal(catalog.movies[0].posterUrl, "https://cinema.example/poster.webp");
  assert.deepEqual(catalog.movies[0].artworkMetadata, { containsTitle: true, poster: { dominantAsset: "logo" } });
  assert.deepEqual(catalog.availableSessions.map((session) => session.id), ["session-1"]);
  assert.deepEqual(catalog.programming.map((session) => session.id), ["session-1", "session-2"]);
  assert.equal(catalog.programming[0].ticketTypes[0].price, 10);
  assert.equal(catalog.programming[0].room.name, "Sala 1");
  assert.deepEqual(catalog.dates.map((date) => [date.sessionCount, date.availableSessionCount]), [[2, 1]]);
  assert.equal(catalog.concessions[0].imageUrl, "https://cinema.example/popcorn.webp");
  assert.deepEqual(catalog.promotions.map((offer) => offer.id), ["promo"]);
  assert.deepEqual(catalog.coupons.map((offer) => offer.code), ["CINEMA"]);
});
