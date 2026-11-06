function createEmailCampaignInputService({ crypto, validCampaignTemplate, appFrontendUrl }) {
  function normalizeCampaignBlocks(value, existing = []) {
    const allowedTypes = new Set(["logo", "kicker", "heading", "text", "image", "button", "divider", "icon", "social", "signature", "spacer"]);
    const blocks = Array.isArray(value) ? value : Array.isArray(existing) ? existing : [];
    const color = (candidate, fallback) => /^#[0-9a-f]{6}$/i.test(String(candidate || "").trim()) ? String(candidate).trim().toLowerCase() : fallback;
    const number = (candidate, min, max, fallback) => Number.isFinite(Number(candidate)) ? Math.max(min, Math.min(max, Number(candidate))) : fallback;
    return blocks.slice(0, 50).map((item = {}) => {
      const type = allowedTypes.has(item.type) ? item.type : "text";
      return {
        id: String(item.id || `bloco-${crypto.randomUUID()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100),
        type,
        role: String(item.role || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50),
        content: String(item.content || "").slice(0, 12000),
        url: String(item.url || "").trim().slice(0, 2000),
        alt: String(item.alt || "").trim().slice(0, 180),
        link: String(item.link || "").trim().slice(0, 1000),
        align: ["left", "center", "right"].includes(item.align) ? item.align : "left",
        color: color(item.color, type === "heading" ? "#ffffff" : "#dbeafe"),
        backgroundColor: color(item.backgroundColor, "#facc15"),
        width: number(item.width, 4, 100, type === "icon" ? 12 : 70),
        fontSize: number(item.fontSize, 9, 42, type === "heading" ? 28 : 15),
        height: number(item.height, 8, 80, 24),
        links: Array.isArray(item.links) ? item.links.slice(0, 6).map((link) => ({ label: String(link?.label || "").trim().slice(0, 40), url: String(link?.url || "").trim().slice(0, 1000) })) : []
      };
    });
  }

  function normalizeEmailLogoUrl(value = "") {
    const raw = String(value || "").trim();
    if (!raw || /\/images\/logo-display\.webp(?:[?#].*)?$/i.test(raw)) {
      return `${appFrontendUrl()}/images/favicon-email.png`;
    }
    return raw;
  }

  function normalizeEmailBrand(brand = {}) {
    return {
      ...(brand && typeof brand === "object" ? brand : {}),
      logoUrl: normalizeEmailLogoUrl(brand?.logoUrl)
    };
  }

  function normalizeCampaignInput(input = {}, existing = {}) {
    const mode = ["template", "html"].includes(input.mode) ? input.mode : (existing.mode === "legacy_visual" ? "legacy_visual" : "template");
    const templateId = validCampaignTemplate(input.templateId, validCampaignTemplate(existing.templateId, "announcement"));
    const templateSelectionMode = ["automatic", "manual"].includes(input.templateSelectionMode)
      ? input.templateSelectionMode
      : ["automatic", "manual"].includes(existing.templateSelectionMode)
        ? existing.templateSelectionMode
        : existing.id ? "manual" : "automatic";
    const status = input.status || existing.status || "draft";
    const reservedVariables = new Set(["nome", "email", "codigo_cupom", "validade_cupom", "link_cupom"]);
    const campaignColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : fallback;
    const artDirectionSource = input.artDirection && typeof input.artDirection === "object" ? input.artDirection : (existing.artDirection || {});
    const artDirection = {
      heroLayout: ["stacked", "split", "cinematic"].includes(artDirectionSource.heroLayout) ? artDirectionSource.heroLayout : "stacked",
      motifs: (Array.isArray(artDirectionSource.motifs) ? artDirectionSource.motifs : []).filter((item) => ["filmstrip", "package", "blueprint", "road", "impact", "ticket", "spotlight", "metal", "energy", "smoke"].includes(item)).slice(0, 3),
      offerCardStyle: ["classic", "package", "blueprint", "ticket"].includes(artDirectionSource.offerCardStyle) ? artDirectionSource.offerCardStyle : "classic",
      dividerStyle: ["line", "dashed", "road", "tape", "metal", "energy"].includes(artDirectionSource.dividerStyle) ? artDirectionSource.dividerStyle : "line",
      ctaPlacement: ["standard", "repeated"].includes(artDirectionSource.ctaPlacement) ? artDirectionSource.ctaPlacement : "standard"
    };
    const contentSections = (Array.isArray(input.contentSections) ? input.contentSections : (existing.contentSections || []))
      .map((section) => ({
        type: ["body", "highlight", "steps", "quote"].includes(section?.type) ? section.type : "body",
        title: String(section?.title || "").trim().slice(0, 100),
        body: String(section?.body || "").trim().slice(0, 700),
        items: (Array.isArray(section?.items) ? section.items : []).map((item) => String(item || "").trim().slice(0, 180)).filter(Boolean).slice(0, 5)
      }))
      .filter((section) => section.title || section.body || section.items.length)
      .slice(0, 6);
    return {
      ...existing,
      id: existing.id || String(input.id || `campanha-email-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`),
      idempotencyKey: String(input.idempotencyKey ?? existing.idempotencyKey ?? "").trim().slice(0, 160),
      subject: String(input.subject ?? existing.subject ?? "").trim().slice(0, 180),
      mode,
      templateId,
      objective: String(input.objective ?? existing.objective ?? "").trim().slice(0, 40),
      templateSelectionMode,
      templateReason: String(input.templateReason ?? existing.templateReason ?? "").trim().slice(0, 300),
      compatibleTemplates: Array.isArray(input.compatibleTemplates) ? input.compatibleTemplates.filter((item) => validCampaignTemplate(item, "") === item).slice(0, 14) : (existing.compatibleTemplates || []),
      preheader: String(input.preheader ?? existing.preheader ?? "").trim().slice(0, 140),
      kicker: String(input.kicker ?? existing.kicker ?? "").trim().slice(0, 80),
      headline: String(input.headline ?? existing.headline ?? "").trim().slice(0, 180),
      message: String(input.message ?? existing.message ?? "").slice(0, 12000),
      html: String(input.html ?? existing.html ?? "").slice(0, 100000),
      variables: Object.fromEntries(Object.entries(input.variables ?? existing.variables ?? {}).filter(([key, value]) => /^[a-z][a-z0-9_]{0,39}$/i.test(key) && !reservedVariables.has(String(key).toLowerCase()) && String(value ?? "").trim()).slice(0, 48).map(([key, value]) => [key.toLowerCase(), String(value).trim().slice(0, 1000)])),
      ctaLabel: String(input.ctaLabel ?? existing.ctaLabel ?? "Ver programação").trim().slice(0, 80),
      ctaUrl: String(input.ctaUrl ?? existing.ctaUrl ?? "").trim().slice(0, 1000),
      ctaButtons: (Array.isArray(input.ctaButtons) ? input.ctaButtons : (existing.ctaButtons || []))
        .map((button) => ({
          label: String(button?.label || "").trim().slice(0, 80),
          intent: String(button?.intent || "").trim().slice(0, 32),
          url: String(button?.url || "").trim().slice(0, 1000)
        }))
        .filter((button) => button.label && button.url)
        .slice(0, 3),
      recipientMode: ["all", "selected", "purchased", "recent", "reactivation", "birthday_manual"].includes(input.recipientMode || existing.recipientMode) ? (input.recipientMode || existing.recipientMode) : "all",
      reactivationDays: Math.max(30, Math.min(730, Number(input.reactivationDays ?? existing.reactivationDays ?? 90))),
      customerIds: Array.isArray(input.customerIds) ? input.customerIds.map(String).slice(0, 5000) : (existing.customerIds || []),
      recipientSearch: String(input.recipientSearch ?? existing.recipientSearch ?? "").trim().slice(0, 160),
      couponId: String(input.couponId ?? existing.couponId ?? "").trim(),
      movieId: String(input.movieId ?? existing.movieId ?? "").trim().slice(0, 180),
      movieIds: Array.isArray(input.movieIds)
        ? [...new Set(input.movieIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 20)
        : Array.isArray(existing.movieIds) ? existing.movieIds.map(String).slice(0, 20) : (existing.movieId ? [String(existing.movieId)] : []),
      concessionId: String(input.concessionId ?? existing.concessionId ?? (Array.isArray(input.concessionIds) ? input.concessionIds[0] : "") ?? "").trim().slice(0, 180),
      concessionIds: Array.isArray(input.concessionIds)
        ? [...new Set(input.concessionIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 20)
        : Array.isArray(existing.concessionIds) ? existing.concessionIds.map(String).slice(0, 20) : (existing.concessionId ? [String(existing.concessionId)] : []),
      clubPlanId: String(input.clubPlanId ?? existing.clubPlanId ?? "").trim().slice(0, 180),
      clubOffer: String(input.clubOffer ?? existing.clubOffer ?? "").trim().slice(0, 500),
      attachments: Array.isArray(input.attachments) ? input.attachments.slice(0, 5).map((item) => ({ id: String(item.id || ""), filename: String(item.filename || "anexo").slice(0, 100), contentType: String(item.contentType || "application/octet-stream"), size: Number(item.size || 0), path: String(item.path || "") })).filter((item) => item.id && item.path) : (existing.attachments || []),
      imageUrl: String(input.imageUrl ?? existing.imageUrl ?? "").trim().slice(0, 2000),
      imageAlt: String(input.imageAlt ?? existing.imageAlt ?? "").trim().slice(0, 140),
      imageLink: String(input.imageLink ?? existing.imageLink ?? "").trim().slice(0, 1000),
      accentColor: campaignColor(input.accentColor ?? existing.accentColor, "#facc15"),
      headlineColor: campaignColor(input.headlineColor ?? existing.headlineColor, "#ffffff"),
      textColor: campaignColor(input.textColor ?? existing.textColor, "#dbeafe"),
      buttonColor: campaignColor(input.buttonColor ?? existing.buttonColor, "#facc15"),
      visualStyle: ["classic", "premiere", "nostalgic", "playful", "dramatic", "elegant", "fresh", "emerald"].includes(input.visualStyle)
        ? input.visualStyle
        : existing.visualStyle || "classic",
      visualStyleLabel: String(input.visualStyleLabel ?? existing.visualStyleLabel ?? "").trim().slice(0, 120),
      artDirection,
      contentSections,
      autoCouponId: String(input.autoCouponId ?? existing.autoCouponId ?? "").trim().slice(0, 180),
      aiPromptTemplateId: String(input.aiPromptTemplateId ?? existing.aiPromptTemplateId ?? "").trim().slice(0, 40),
      aiPromptTemplateName: String(input.aiPromptTemplateName ?? existing.aiPromptTemplateName ?? "").trim().slice(0, 120),
      contentBlocks: existing.mode === "legacy_visual" ? normalizeCampaignBlocks(existing.contentBlocks) : [],
      scheduleAt: (() => { const value = String(input.scheduleAt ?? existing.scheduleAt ?? "").trim(); return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : ""; })(),
      status,
      brand: normalizeEmailBrand(input.brand ?? existing.brand ?? {}),
      createdBy: existing.createdBy || input.createdBy || "",
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sent: Number(existing.sent || 0),
      failed: Number(existing.failed || 0),
      delivered: existing.delivered ?? null,
      bounced: existing.bounced ?? null,
      opened: existing.opened ?? null,
      clicked: existing.clicked ?? null
    };
  }

  return { normalizeCampaignBlocks, normalizeEmailLogoUrl, normalizeEmailBrand, normalizeCampaignInput };
}

module.exports = { createEmailCampaignInputService };
