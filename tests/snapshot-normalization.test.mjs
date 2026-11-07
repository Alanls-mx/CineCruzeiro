import assert from "node:assert/strict";
import { test } from "node:test";
import settingsModule from "../backend/services/snapshotSettingsNormalizer.js";
import movieModule from "../backend/services/snapshotMovieNormalizer.js";
import ticketReport from "../backend/services/ticketDistributorReportService.js";

test("settings preserve absent defaults, explicit values and legacy URL cleanup", () => {
  const inspectedUrls = [];
  const snapshot = { settings: {
    defaultTicketPrice: 15,
    salesChannel: "WhatsApp",
    clubHeroImageUrl: "/uploads/hero.webp",
    eventGamesImageUrl: "https://invalid.example/image.png",
    ticketDistributorRules: { distributorPercent: 40 }
  } };
  settingsModule.normalizeSnapshotSettings(snapshot, {
    cinemaName: "Instalação sintética",
    announcementText: "Mensagem sintética",
    normalizeTicketDistributorRules: ticketReport.normalizeRules,
    storedEditorialImageUrl(value) { inspectedUrls.push(value); return value === "/uploads/hero.webp" ? value : ""; }
  });
  assert.equal(snapshot.settings.cinemaName, "Instalação sintética");
  assert.equal(snapshot.settings.announcementText, "Mensagem sintética");
  assert.equal(snapshot.settings.defaultTicketPrice, 15);
  assert.equal(snapshot.settings.salesChannel, "Site + Pix");
  assert.equal(snapshot.settings.clubHeroImageUrl, "/uploads/hero.webp");
  assert.equal(snapshot.settings.eventGamesImageUrl, "");
  assert.equal(inspectedUrls.length, 7);
  assert.equal(snapshot.settings.adminTwoFactorRequired, true);
  assert.equal(snapshot.settings.ticketDistributorRules.distributorPercent, 40);
});

test("movie and session defaults preserve sorting, active ticket types and prices", () => {
  const snapshot = {
    settings: { defaultTicketPrice: 12 },
    ticketTypes: [
      { id: "full", price: 18, active: true },
      { id: "half", price: 9, active: true },
      { id: "old", price: 4, active: false }
    ],
    movies: [
      { id: "later", title: "Depois", displayOrder: 20, sessions: [
        { id: "selected", ticketTypeIds: ["half", "half", "missing"], priceFull: 99 },
        { id: "fallback", ticketTypeIds: [] }
      ] },
      { id: "earlier", title: "Antes", status: "hidden", displayOrder: 1 }
    ]
  };
  movieModule.normalizeSnapshotMovies(snapshot, { slugify: (value) => value.toLowerCase() });
  assert.deepEqual(snapshot.movies.map((movie) => movie.id), ["earlier", "later"]);
  assert.equal(snapshot.movies[0].workflowStatus, "archived");
  assert.deepEqual(snapshot.movies[0].sessions, []);
  assert.equal(snapshot.movies[1].sortOrder, 20);
  assert.deepEqual(snapshot.movies[1].sessions[0].ticketTypeIds, ["half"]);
  assert.equal(snapshot.movies[1].sessions[0].priceFull, 9);
  assert.equal(snapshot.movies[1].sessions[0].priceHalf, 9);
  assert.deepEqual(snapshot.movies[1].sessions[1].ticketTypeIds, ["full", "half"]);
  assert.equal(snapshot.movies[1].sessions[1].priceFull, 18);
  assert.equal(snapshot.movies[1].sessions[1].priceHalf, 9);
  assert.deepEqual(snapshot.rooms, []);
});
