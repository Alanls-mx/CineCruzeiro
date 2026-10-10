function createCommercialCatalogHandler({
  assertPromotionRules,
  concessionRepository,
  couponUsageHistory,
  couponUsageSummary,
  normalizeAd,
  normalizeConcession,
  normalizePromotion,
  postgresEnabled,
  promotionRepository,
  readBody,
  repositoryAudit,
  sendJson,
  settingsRepository,
  writeDb
}) {
  return async function handleCommercialCatalogRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/concessions" && method === "POST") {
    const item = normalizeConcession(await readBody(req));
    db.concessions = db.concessions.filter((existing) => existing.id !== item.id);
    db.concessions.push(item);
    db.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    const saved = postgresEnabled()
      ? await concessionRepository.create(item, { audit: repositoryAudit(req, "concession", item.id, null, item) })
      : (await writeDb(db), item);
    sendJson(res, 201, saved);
    return true;
  }

  const concessionMatch = pathname.match(/^\/api\/concessions\/([^/]+)$/);
  if (concessionMatch) {
    const id = decodeURIComponent(concessionMatch[1]);
    const index = db.concessions.findIndex((item) => item.id === id);
    const repositoryItem = postgresEnabled() ? await concessionRepository.findById(id) : null;
    if (index === -1 && !repositoryItem) {
      sendJson(res, 404, { error: "Produto da bomboniere nao encontrado" });
      return true;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      const previous = repositoryItem || db.concessions[index];
      if (!previous) {
        sendJson(res, 404, { error: "Produto da bomboniere nao encontrado" });
        return true;
      }
      const item = normalizeConcession(body, previous);
      db.concessions[index] = item;
      db.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
      const inventoryChanged = ["stock", "reserved", "sold"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
      const saved = postgresEnabled()
        ? await concessionRepository.update(item, {
          updateInventory: inventoryChanged,
          expectedInventory: { stock: previous.stock, reserved: previous.reserved, sold: previous.sold },
          audit: repositoryAudit(req, "concession", id, previous, item)
        })
        : (await writeDb(db), item);
      sendJson(res, 200, saved);
      return true;
    }

    if (method === "DELETE") {
      const [removed] = index >= 0 ? db.concessions.splice(index, 1) : [repositoryItem];
      const saved = postgresEnabled()
        ? await concessionRepository.remove(id, { audit: repositoryAudit(req, "concession", id, removed, null) })
        : (await writeDb(db), removed);
      sendJson(res, 200, saved);
      return true;
    }
  }

  if (pathname === "/api/promotions" && method === "POST") {
    const item = normalizePromotion(await readBody(req));
    assertPromotionRules(db, item);
    db.promotions = db.promotions.filter((existing) => existing.id !== item.id);
    db.promotions.push(item);
    const saved = postgresEnabled()
      ? await promotionRepository.create(item, { audit: repositoryAudit(req, "promotions", item.id, null, item) })
      : (await writeDb(db), item);
    sendJson(res, 201, saved);
    return true;
  }

  const promotionUsageMatch = pathname.match(/^\/api\/promotions\/([^/]+)\/usage$/);
  if (promotionUsageMatch && method === "GET") {
    const id = decodeURIComponent(promotionUsageMatch[1]);
    const coupon = db.promotions.find((item) => item.id === id);
    if (!coupon) {
      sendJson(res, 404, { error: { code: "COUPON_NOT_FOUND", message: "Cupom não encontrado." } });
      return true;
    }
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    sendJson(res, 200, couponUsageHistory(db, coupon, {
      page: requestUrl.searchParams.get("page"),
      pageSize: requestUrl.searchParams.get("pageSize")
    }));
    return true;
  }

  const promotionMatch = pathname.match(/^\/api\/promotions\/([^/]+)$/);
  if (promotionMatch) {
    const id = decodeURIComponent(promotionMatch[1]);
    const index = db.promotions.findIndex((item) => item.id === id);
    const repositoryPromotion = postgresEnabled() ? await promotionRepository.findById(id) : null;
    if (index === -1 && !repositoryPromotion) {
      sendJson(res, 404, { error: "Promocao nao encontrada" });
      return true;
    }

    if (method === "PUT") {
      const previous = repositoryPromotion || db.promotions[index];
      if (!previous) {
        sendJson(res, 404, { error: "Promocao nao encontrada" });
        return true;
      }
      if (index >= 0) db.promotions[index] = previous;
      const item = normalizePromotion(await readBody(req), previous);
      assertPromotionRules(db, item, id);
      const endsAt = item.endsAt ? new Date(item.endsAt).getTime() : 0;
      if (item.active && (!endsAt || endsAt > Date.now())) {
        item.archivedAt = "";
        item.archiveReason = "";
      }
      if (index >= 0) db.promotions[index] = item;
      const saved = postgresEnabled()
        ? await promotionRepository.update(item, { audit: repositoryAudit(req, "promotions", id, previous, item) })
        : (await writeDb(db), item);
      sendJson(res, 200, saved);
      return true;
    }

    if (method === "DELETE") {
      const previous = repositoryPromotion || db.promotions[index];
      if (!previous) {
        sendJson(res, 404, { error: "Promocao nao encontrada" });
        return true;
      }
      if (index >= 0) db.promotions[index] = previous;
      const usage = couponUsageSummary(db, previous);
      let removed;
      if (usage.usageCount > 0) {
        removed = {
          ...previous,
          active: false,
          archivedAt: new Date().toISOString(),
          archiveReason: "manual",
          updatedAt: new Date().toISOString()
        };
        if (index >= 0) db.promotions[index] = removed;
      } else {
        [removed] = index >= 0 ? db.promotions.splice(index, 1) : [previous];
      }
      if (postgresEnabled()) {
        if (usage.usageCount > 0) {
          removed = await promotionRepository.update(removed, { audit: repositoryAudit(req, "promotions", id, previous, removed) });
        } else {
          removed = await promotionRepository.remove(id, { audit: repositoryAudit(req, "promotions", id, previous, null) });
        }
      } else {
        await writeDb(db);
      }
      sendJson(res, 200, { ...removed, deleted: usage.usageCount === 0, archived: usage.usageCount > 0 });
      return true;
    }
  }

  if (pathname === "/api/ads" && method === "POST") {
    const item = normalizeAd(await readBody(req));
    db.ads = db.ads.filter((existing) => existing.id !== item.id);
    db.ads.push(item);
    await writeDb(db);
    sendJson(res, 201, item);
    return true;
  }

  if (pathname === "/api/ads/status" && method === "PUT") {
    const body = await readBody(req);
    if (typeof body.enabled !== "boolean") {
      sendJson(res, 422, { error: { code: "ADS_STATUS_INVALID", message: "Informe se os anúncios devem ficar ligados ou desligados." } });
      return true;
    }
    const previous = { adsEnabled: db.settings?.adsEnabled !== false };
    const patch = { adsEnabled: body.enabled };
    db.settings = { ...(db.settings || {}), ...patch };
    if (postgresEnabled()) {
      await settingsRepository.patchAppSettings(patch, { audit: repositoryAudit(req, "settings", "ads", previous, patch) });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { enabled: body.enabled, updatedAt: new Date().toISOString() });
    return true;
  }

  const adMatch = pathname.match(/^\/api\/ads\/([^/]+)$/);
  if (adMatch) {
    const id = decodeURIComponent(adMatch[1]);
    const index = db.ads.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Anuncio nao encontrado" });
      return true;
    }

    if (method === "PUT") {
      const item = normalizeAd(await readBody(req), db.ads[index]);
      db.ads[index] = item;
      await writeDb(db);
      sendJson(res, 200, item);
      return true;
    }

    if (method === "DELETE") {
      const [removed] = db.ads.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return true;
    }
  }

    return false;
  };
}

module.exports = { createCommercialCatalogHandler };
