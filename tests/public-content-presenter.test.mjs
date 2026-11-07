import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createPublicContentPresenter } = require("../backend/services/publicContentPresenter.js");

const getContent = createPublicContentPresenter({
  assetMovie: (movie) => movie,
  assetRecord: (record) => record,
  buildCalendarDaysForMovies: () => [],
  clubSavingsSummary: () => ({}),
  couponUsageSummary: () => ({}),
  enrichTicket: (_db, ticket) => ticket,
  integrationConfigService: { resolvedConfig: () => ({ enabled: false }) },
  isDeletedMovie: () => false,
  publicContentSettings: (settings) => ({ cinemaName: settings.cinemaName }),
  publicSessionStatus: () => "available",
  sanitizeUser: (user) => ({ id: user.id }),
  sellableSessions: (movie) => movie.sessions,
  sessionWithCurrentRoom: (_db, session) => session,
  todayIsoDate: () => "2026-11-06"
});

const db = {
  settings: { cinemaName: "Cinema de teste", privateKey: "secret" },
  movies: [{ id: "movie-1", title: "Filme", status: "now_playing", sessions: [] }],
  rooms: [], ticketTypes: [],
  concessions: [{ id: "snack-1", name: "Pipoca", stock: 5, reserved: 1, sold: 2 }],
  promotions: [], ads: [],
  users: [{ id: "user-1", email: "private@example.test" }],
  orders: [], payments: [], tickets: [], auditLogs: []
};

test("public content does not expose private settings, stock or customer data", () => {
  const publicContent = getContent(db);
  assert.equal(publicContent.settings.cinemaName, "Cinema de teste");
  assert.equal("privateKey" in publicContent.settings, false);
  assert.equal("stock" in publicContent.concessions[0], false);
  assert.equal("users" in publicContent, false);
});

test("admin projection preserves private data for downstream permission filtering", () => {
  const privateContent = getContent(db, { includePrivate: true });
  assert.equal(privateContent.settings.privateKey, "secret");
  assert.equal(privateContent.concessions[0].stock, 5);
  assert.deepEqual(privateContent.users, [{ id: "user-1" }]);
});
