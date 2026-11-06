function createCinemaSettingsHandler({ readBody, storedEditorialImageUrl, postgresEnabled, settingsRepository, repositoryAudit, writeDb, sendJson, assetRecord }) {
  return async function handleCinemaSettingsRoutes({ req, res, pathname, method, db }) {
    if (pathname === "/api/settings" && method === "PUT") {
      const body = await readBody(req);
      if (body.eventStartingPrice !== undefined) {
        body.eventStartingPrice = Math.max(0, Number(body.eventStartingPrice || 0));
      }
      ["clubTransparentImages", "eventTransparentImages"].forEach((key) => {
        if (body[key] !== undefined) body[key] = body[key] === true;
      });
      [
        "eventHeroImageUrl",
        "eventGamesImageUrl",
        "eventPartiesImageUrl",
        "eventCorporateImageUrl",
        "eventGalleryImageUrl",
        "clubHeroImageUrl",
        "clubBannerImageUrl"
      ].forEach((key) => {
        if (body[key] !== undefined) body[key] = storedEditorialImageUrl(body[key]);
      });
      const previous = Object.fromEntries(Object.keys(body).map((key) => [key, db.settings?.[key]]));
      db.settings = { ...db.settings, ...body };
      const savedSettings = postgresEnabled()
        ? await settingsRepository.patchAppSettings(body, { audit: repositoryAudit(req, "settings", "app", previous, body) })
        : (await writeDb(db), db.settings);
      sendJson(res, 200, assetRecord(savedSettings, [
        "eventHeroImageUrl",
        "eventGamesImageUrl",
        "eventPartiesImageUrl",
        "eventCorporateImageUrl",
        "eventGalleryImageUrl",
        "clubHeroImageUrl",
        "clubBannerImageUrl"
      ]));
      return true;
    }

    return false;
  };
}

module.exports = { createCinemaSettingsHandler };
