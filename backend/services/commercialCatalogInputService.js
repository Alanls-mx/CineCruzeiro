function createCommercialCatalogInputService({ slugify, storedLocalUploadUrl }) {
  function normalizeConcession(input, existing = {}) {
    const name = String(input.name || existing.name || "Produto").trim();
    const stockValue = input.stock !== undefined ? input.stock : existing.stock;
    const reservedValue = input.reserved !== undefined ? input.reserved : existing.reserved;
    const soldValue = input.sold !== undefined ? input.sold : existing.sold;
    const tagValue = input.tags !== undefined ? input.tags : existing.tags;
    const comboItemsValue = input.comboItems !== undefined ? input.comboItems : existing.comboItems;
    const tags = Array.isArray(tagValue)
      ? tagValue
      : String(tagValue || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const comboItems = Array.isArray(comboItemsValue)
      ? comboItemsValue.map((item) => ({
          name: String(item.name || "").trim(),
          quantity: Math.max(1, Number(item.quantity || 1))
        })).filter((item) => item.name)
      : String(comboItemsValue || "")
          .split(/\r?\n/)
          .map((line) => {
            const [namePart, quantityPart] = line.split("|");
            return {
              name: String(namePart || "").trim(),
              quantity: Math.max(1, Number(quantityPart || 1))
            };
          })
          .filter((item) => item.name);
    const stockUnit = ["unit", "kg", "g", "mg"].includes(String(input.stockUnit || existing.stockUnit || "unit"))
      ? String(input.stockUnit || existing.stockUnit || "unit")
      : "unit";
    const usagePerSale = stockUnit === "unit"
      ? 1
      : Math.max(0.001, Number(input.usagePerSale ?? existing.usagePerSale ?? 1));

    return {
      id: String(input.id || existing.id || slugify(name) || `produto-${Date.now()}`),
      sku: String(input.sku || existing.sku || slugify(name) || `sku-${Date.now()}`),
      name,
      description: input.description || existing.description || "",
      imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
      badge: input.badge !== undefined ? String(input.badge || "").trim() : existing.badge || "",
      price: Number(input.price ?? existing.price ?? 0),
      compareAt: input.compareAt === "" ? "" : Number(input.compareAt ?? existing.compareAt ?? 0),
      category: input.category || existing.category || "combo",
      stock: stockValue === "" || stockValue === undefined ? "" : Math.max(0, Number(Number(stockValue).toFixed(3))),
      stockUnit,
      usagePerSale: Number(usagePerSale.toFixed(3)),
      reserved: reservedValue === "" || reservedValue === undefined ? 0 : Math.max(0, Number(reservedValue || 0)),
      sold: soldValue === "" || soldValue === undefined ? 0 : Math.max(0, Number(soldValue || 0)),
      maxPerOrder: Number(input.maxPerOrder ?? existing.maxPerOrder ?? 8),
      featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
      sortOrder: Number(input.sortOrder ?? existing.sortOrder ?? 100),
      tags,
      comboItems,
      active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
    };
  }

  function normalizePromotion(input, existing = {}) {
    const title = String(input.title || existing.title || "Promocao").trim();
    const couponCode = String(input.couponCode ?? existing.couponCode ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    const discountType = ["fixed_price", "percent", "amount"].includes(input.discountType) ? input.discountType : existing.discountType || "amount";
    return {
      id: String(input.id || existing.id || slugify(title) || `promocao-${Date.now()}`),
      title,
      description: input.description || existing.description || "",
      discountType,
      value: Math.max(0, Number(input.value ?? existing.value ?? 0)),
      couponCode,
      startsAt: input.startsAt || existing.startsAt || "",
      endsAt: input.endsAt || existing.endsAt || "",
      appliesTo: ["all", "tickets", "concessions"].includes(input.appliesTo) ? input.appliesTo : existing.appliesTo || "all",
      minimumOrderValue: Math.max(0, Number(input.minimumOrderValue ?? existing.minimumOrderValue ?? 0)),
      maximumDiscount: Math.max(0, Number(input.maximumDiscount ?? existing.maximumDiscount ?? 0)),
      usageLimit: Math.max(0, Math.floor(Number(input.usageLimit ?? existing.usageLimit ?? 0))),
      perCustomerLimit: Math.max(0, Math.floor(Number(input.perCustomerLimit ?? existing.perCustomerLimit ?? 0))),
      firstPurchaseOnly: input.firstPurchaseOnly !== undefined ? Boolean(input.firstPurchaseOnly) : Boolean(existing.firstPurchaseOnly),
      allowClubStacking: input.allowClubStacking !== undefined ? Boolean(input.allowClubStacking) : Boolean(existing.allowClubStacking),
      allowedMovieIds: Array.isArray(input.allowedMovieIds)
        ? input.allowedMovieIds.map((id) => String(id || "").trim()).filter(Boolean)
        : Array.isArray(existing.allowedMovieIds) ? existing.allowedMovieIds : [],
      active: input.active !== undefined ? Boolean(input.active) : existing.active !== false,
      sourceCampaignId: String(input.sourceCampaignId ?? existing.sourceCampaignId ?? "").trim().slice(0, 180),
      autoManagedByCampaign: input.autoManagedByCampaign !== undefined ? Boolean(input.autoManagedByCampaign) : Boolean(existing.autoManagedByCampaign),
      autoCouponActivationScheduled: input.autoCouponActivationScheduled !== undefined ? Boolean(input.autoCouponActivationScheduled) : Boolean(existing.autoCouponActivationScheduled),
      autoCouponValidityMode: ["explicit", "relative"].includes(input.autoCouponValidityMode) ? input.autoCouponValidityMode : existing.autoCouponValidityMode || "",
      autoCouponDurationDays: Math.max(0, Math.min(31, Number(input.autoCouponDurationDays ?? existing.autoCouponDurationDays ?? 0))),
      archivedAt: String(input.archivedAt ?? existing.archivedAt ?? ""),
      archiveReason: String(input.archiveReason ?? existing.archiveReason ?? ""),
      createdAt: existing.createdAt || input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function assertPromotionRules(db, promotion, currentId = "") {
    if (promotion.value <= 0) throw Object.assign(new Error("Informe um valor de desconto maior que zero."), { statusCode: 422, code: "COUPON_VALUE_REQUIRED" });
    if (promotion.discountType === "percent" && promotion.value > 100) {
      throw Object.assign(new Error("O desconto percentual não pode ultrapassar 100%."), { statusCode: 422, code: "COUPON_PERCENT_INVALID" });
    }
    const startsAt = promotion.startsAt ? new Date(promotion.startsAt).getTime() : 0;
    const endsAt = promotion.endsAt ? new Date(promotion.endsAt).getTime() : 0;
    if ((promotion.startsAt && !Number.isFinite(startsAt)) || (promotion.endsAt && !Number.isFinite(endsAt))) {
      throw Object.assign(new Error("Informe datas válidas para o período do cupom."), { statusCode: 422, code: "COUPON_PERIOD_INVALID" });
    }
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw Object.assign(new Error("A data final deve ser posterior à data inicial."), { statusCode: 422, code: "COUPON_PERIOD_INVALID" });
    }
    if (promotion.couponCode && (db.promotions || []).some((item) => item.id !== currentId && item.couponCode === promotion.couponCode)) {
      throw Object.assign(new Error("Já existe um cupom com este código."), { statusCode: 409, code: "COUPON_CODE_DUPLICATE" });
    }
  }

  function normalizeAd(input, existing = {}, { preserveTimestamp = false } = {}) {
    const title = String(input.title || existing.title || "Anuncio").trim();
    const startsAt = String(input.startsAt ?? existing.startsAt ?? "").trim();
    const endsAt = String(input.endsAt ?? existing.endsAt ?? "").trim();
    if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
      throw Object.assign(new Error("O fim da exibição deve ser posterior ao início."), { statusCode: 422, code: "AD_PERIOD_INVALID" });
    }
    return {
      id: String(input.id || existing.id || slugify(title) || `anuncio-${Date.now()}`),
      title,
      description: String(input.description ?? existing.description ?? "").trim().slice(0, 500),
      placement: "movie",
      imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
      linkUrl: input.linkUrl || existing.linkUrl || "",
      ctaLabel: String(input.ctaLabel ?? existing.ctaLabel ?? "Saiba mais").trim().slice(0, 60),
      startsAt: startsAt && Number.isFinite(new Date(startsAt).getTime()) ? new Date(startsAt).toISOString() : "",
      endsAt: endsAt && Number.isFinite(new Date(endsAt).getTime()) ? new Date(endsAt).toISOString() : "",
      impressions: Math.max(0, Number(existing.impressions || 0)),
      clicks: Math.max(0, Number(existing.clicks || 0)),
      lastImpressionAt: existing.lastImpressionAt || "",
      lastClickAt: existing.lastClickAt || "",
      createdAt: existing.createdAt || input.createdAt || new Date().toISOString(),
      updatedAt: preserveTimestamp ? (existing.updatedAt || input.updatedAt || new Date().toISOString()) : new Date().toISOString(),
      active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
    };
  }
  return { normalizeConcession, normalizePromotion, assertPromotionRules, normalizeAd };
}

module.exports = { createCommercialCatalogInputService };
