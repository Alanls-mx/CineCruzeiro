import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PRE_PREMIERE_WINDOW_MS } = require("../backend/services/moviePublicationPolicy.js");
const source = fs.readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp(`^function ${name}\\([^]*?^}`, "m"));
  assert.ok(match, `baseline function ${name}`);
  return match[0];
}

const assetNames = ["configuredAppBasePath", "publicAssetUrl", "storedAssetUrl", "storedLocalUploadUrl", "storedEditorialImageUrl", "stripPublicAssetBase", "appFrontendUrl", "getFirstEnv"];
const assetContext = vm.createContext({
  process: { env: { NEXT_PUBLIC_BASE_PATH: "/projects/cine", FRONTEND_URL: "https://cinema.example/projects/cine" } },
  FRONTEND_URL_ENV_KEYS: ["FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"], URL
});
vm.runInContext(assetNames.map(declaration).join("\n"), assetContext);

test("baseline asset paths preserve tenant prefix, upload storage and editorial allowlist", () => {
  assert.equal(assetContext.publicAssetUrl("/uploads/poster.webp"), "/projects/cine/uploads/poster.webp");
  assert.equal(assetContext.storedAssetUrl("/projects/cine/uploads/poster.webp"), "/uploads/poster.webp");
  assert.equal(assetContext.storedLocalUploadUrl("https://example.test/poster.webp"), "");
  assert.equal(assetContext.storedEditorialImageUrl("https://images.unsplash.com/photo-123"), "https://images.unsplash.com/photo-123");
  assert.equal(assetContext.storedEditorialImageUrl("https://example.test/photo"), "");
  assert.equal(assetContext.stripPublicAssetBase("/projects/cine/uploads/poster.webp"), "/uploads/poster.webp");
  assert.equal(assetContext.appFrontendUrl(), "https://cinema.example/projects/cine");
  assetContext.process.env.FRONTEND_URL = "https://cinema.example";
  assert.equal(assetContext.appFrontendUrl(), "https://cinema.example/projects/cine");
});

const calendarNames = ["todayIsoDate", "sessionStartsAt", "sessionSellableUntil", "sessionSalesOpenAt", "normalizedSessionStatus", "isSessionSellable", "sellableSessions", "datePartsInSaoPaulo", "saoPauloDateFromOffset", "buildCalendarDays", "buildCalendarDaysForMovies"];
const calendarContext = vm.createContext({ Date, Intl, PRE_PREMIERE_SALES_WINDOW_MS: PRE_PREMIERE_WINDOW_MS });
vm.runInContext(calendarNames.map(declaration).join("\n"), calendarContext);

test("baseline session windows and calendar presentation preserve current time rules", () => {
  const session = { date: "2026-11-15", time: "20:00", status: "available" };
  const starts = calendarContext.sessionStartsAt(session);
  assert.equal(starts.toISOString(), "2026-11-15T23:00:00.000Z");
  assert.equal(calendarContext.sessionSellableUntil(session).getTime() - starts.getTime(), 10 * 60 * 1000);
  assert.equal(starts.getTime() - calendarContext.sessionSalesOpenAt(session).getTime(), PRE_PREMIERE_WINDOW_MS);
  assert.equal(calendarContext.isSessionSellable(session, session.date, new Date(starts.getTime() + 11 * 60 * 1000)), false);
  assert.equal(calendarContext.isSessionSellable({ ...session, status: "hidden" }, session.date, new Date(starts)), false);
  assert.equal(calendarContext.sessionStartsAt({ ...session, time: "invalid" }).toISOString(), "2026-11-15T03:00:00.000Z");
  assert.equal(calendarContext.sellableSessions({ sessions: [{ ...session, time: "21:00" }, session] }, new Date(starts)).map((item) => item.time).join(","), "20:00,21:00");
  const days = calendarContext.buildCalendarDaysForMovies([{ sessions: [{ date: "2026-12-31" }] }], 7);
  assert.equal(days.length >= 7, true);
  assert.equal(days.some((day) => day.isoDate === "2026-12-31"), true);
});
