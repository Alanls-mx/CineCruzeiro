import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createCinemaSettingsHandler } = require("../backend/services/cinemaSettingsHandler.js");

test("cinema settings normalize media and answer only after repository commit", async () => {
  const calls = [];
  const db = { settings: { cinemaName: "Cinema Teste", eventHeroImageUrl: "/images/old.webp" } };
  const handler = createCinemaSettingsHandler({
    readBody: async () => ({ eventStartingPrice: -5, eventHeroImageUrl: "unsafe://image", clubTransparentImages: "true" }),
    storedEditorialImageUrl: (url) => url.startsWith("/uploads/") ? url : "",
    postgresEnabled: () => true,
    settingsRepository: { patchAppSettings: async (body) => { calls.push("persist"); return { ...db.settings, ...body }; } },
    repositoryAudit: () => ({ actor: "synthetic" }),
    writeDb: async () => { throw new Error("JSON storage should not run"); },
    sendJson: (_res, status, body) => { calls.push("reply"); assert.equal(status, 200); assert.equal(body.eventStartingPrice, 0); assert.equal(body.eventHeroImageUrl, ""); },
    assetRecord: (value) => value
  });
  assert.equal(await handler({ req: {}, res: {}, pathname: "/api/settings", method: "PUT", db }), true);
  assert.deepEqual(calls, ["persist", "reply"]);
  assert.equal(db.settings.clubTransparentImages, false);
  assert.equal(await handler({ req: {}, res: {}, pathname: "/api/settings", method: "GET", db }), false);
});
