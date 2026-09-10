const {
  TEMPLATE_IDS,
  SCENARIO_COMPATIBLE_TEMPLATES,
  normalizeScenario,
  resolveCampaignTemplate,
  scopeCampaignContext,
  validTemplate,
  isTemplateCompatibleWithScenario,
  compatibleTemplatesForScenario
} = require("./emailCampaignTemplateResolver");
const { requestedButtonHints } = require("./emailCampaignBriefService");

const SCENARIO_DEFAULTS = {
  announcement: { templateId: "announcement", kicker: "Cine Cruzeiro", accent: "#4d8dff", headline: "Uma mensagem para você", ctaLabel: "Saiba mais" },
  programming: { templateId: "weekly", kicker: "Programação do Cine Cruzeiro", accent: "#22d3ee", headline: "Escolha sua próxima sessão", ctaLabel: "Ver programação" },
  premiere: { templateId: "premiere", kicker: "Grande estreia", accent: "#facc15", headline: "Uma nova história começa aqui", ctaLabel: "Ver sessões" },
  now_playing: { templateId: "weekly", kicker: "Em cartaz no Cine Cruzeiro", accent: "#22d3ee", headline: "Seu próximo filme está na tela", ctaLabel: "Ver programação" },
  last_chance: { templateId: "last_chance", kicker: "Últimos dias", accent: "#ff7185", headline: "Não deixe para depois", ctaLabel: "Garantir ingresso" },
  promotion: { templateId: "promotion", kicker: "Oferta especial", accent: "#facc15", headline: "Uma condição especial para você", ctaLabel: "Aproveitar oferta" },
  coupon: { templateId: "coupon", kicker: "Cupom exclusivo", accent: "#45d6a1", headline: "Seu desconto está aqui", ctaLabel: "Usar meu cupom" },
  club: { templateId: "club_plan", kicker: "Clube Cine Cruzeiro", accent: "#facc15", headline: "Mais cinema, mais vantagens", ctaLabel: "Conhecer o Clube" },
  concession: { templateId: "concession", kicker: "Sabor de cinema", accent: "#f59e0b", headline: "Seu filme combina com este momento", ctaLabel: "Ver bomboniere" },
  combo: { templateId: "combo", kicker: "Combo em destaque", accent: "#facc15", headline: "Tudo para completar sua sessão", ctaLabel: "Ver bomboniere" },
  club_plan: { templateId: "club_plan", kicker: "Clube Cine Cruzeiro", accent: "#facc15", headline: "Um plano para viver mais cinema", ctaLabel: "Conhecer o plano" },
  birthday: { templateId: "birthday", kicker: "Uma sessão especial", accent: "#facc15", headline: "Feliz aniversário", ctaLabel: "Comemorar no cinema" },
  event: { templateId: "event", kicker: "Um convite do Cine Cruzeiro", accent: "#22d3ee", headline: "Tem um encontro especial esperando por você", ctaLabel: "Saiba mais" },
  ticket: { templateId: "ticket", kicker: "Ingressos Cine Cruzeiro", accent: "#45d6a1", headline: "Tudo pronto para sua sessão", ctaLabel: "Ver meus ingressos" },
  reactivation: { templateId: "reactivation", kicker: "Sentimos sua falta", accent: "#4d8dff", headline: "Que tal voltar ao cinema?", ctaLabel: "Ver programação" }
};

const TEMPLATE_CONTEXTS = {
  announcement: "relationship",
  weekly: "movie",
  premiere: "movie",
  last_chance: "movie",
  promotion: "offer",
  coupon: "offer",
  concession: "concession",
  combo: "concession",
  club_plan: "club",
  club: "club",
  birthday: "relationship",
  event: "event",
  ticket: "ticket",
  reactivation: "relationship"
};

const VISUAL_STYLE_PRESETS = Object.freeze({
  classic: { label: "Clássico Cine Cruzeiro", accent: "#facc15", background: "#0d1728", header: "#09111f", content: "#0d1728", headline: "#ffffff", text: "#dbeafe", imageWidth: 440, imageRadius: 10, align: "left" },
  premiere: { label: "Estreia em destaque", accent: "#facc15", background: "#09111f", header: "#07101d", content: "#0d1728", headline: "#ffffff", text: "#dbeafe", imageWidth: 460, imageRadius: 8, align: "left" },
  nostalgic: { label: "Nostalgia cinematográfica", accent: "#f6c453", background: "#101827", header: "#09111f", content: "#121b2c", headline: "#fff7e6", text: "#e7dfd1", imageWidth: 410, imageRadius: 6, align: "center" },
  playful: { label: "Sessão em família", accent: "#f59e0b", background: "#0b1728", header: "#081321", content: "#0d1d31", headline: "#ffffff", text: "#dbeafe", imageWidth: 420, imageRadius: 10, align: "center" },
  dramatic: { label: "Impacto de tela grande", accent: "#ff7185", background: "#0a1220", header: "#070e19", content: "#101827", headline: "#ffffff", text: "#dbeafe", imageWidth: 460, imageRadius: 6, align: "left" },
  elegant: { label: "Clube premium", accent: "#facc15", background: "#0a1424", header: "#07101d", content: "#101a2b", headline: "#fff7d6", text: "#dbeafe", imageWidth: 400, imageRadius: 6, align: "left" },
  fresh: { label: "Novidade do cinema", accent: "#45d6a1", background: "#0a1725", header: "#07131f", content: "#0c1c2d", headline: "#ffffff", text: "#dbeafe", imageWidth: 430, imageRadius: 8, align: "left" }
});

const BRAND_COLORS = new Set(["#ffffff", "#fff7e6", "#fff7d6", "#f5e6c8", "#dbeafe", "#e7dfd1", "#facc15", "#fbbf24", "#f6c453", "#f59e0b", "#f97316", "#ef4444", "#22d3ee", "#45d6a1", "#ff7185", "#4d8dff", "#2563eb", "#1d4ed8"]);
const ART_MOTIFS = new Set(["filmstrip", "package", "blueprint", "road", "impact", "ticket", "spotlight"]);
const SECTION_TYPES = new Set(["body", "highlight", "steps", "quote"]);

function defaultVisualStyle(scenario) {
  return ({ premiere: "premiere", last_chance: "dramatic", concession: "playful", combo: "playful", club: "elegant", club_plan: "elegant", coupon: "fresh", promotion: "fresh" })[scenario] || "classic";
}

function visualStyleFromBrief(value) {
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/nostalg|retro|classico|memoria de infancia/.test(text)) return "nostalgic";
  if (/dramatic|impactante|suspense|urgencia/.test(text)) return "dramatic";
  if (/divertid|familia|colorid|animacao/.test(text)) return "playful";
  if (/elegante|premium|sofisticad/.test(text)) return "elegant";
  if (/estreia|blockbuster|cinematografic/.test(text)) return "premiere";
  return "";
}

function resolveVisualStyle(value, scenario) {
  const style = String(value || "").trim().toLowerCase();
  return VISUAL_STYLE_PRESETS[style] ? style : defaultVisualStyle(scenario);
}

function brandSafeColor(value, fallback) {
  const color = safeColor(value, "");
  return BRAND_COLORS.has(color) ? color : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : fallback;
}

function safeText(value, fallback, maxLength, multiline = false) {
  const text = String(value || "").trim();
  const normalized = multiline ? (text || fallback) : String(text || fallback).replace(/\s+/g, " ");
  return normalized.slice(0, maxLength);
}

function briefOpening(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, "").replace(/[*_`]/g, "").trim())
    .find(Boolean)
    ?.slice(0, 360) || "";
}

function safeUrl(value, siteUrl = "") {
  const raw = String(value || "").trim();
  if (!raw || /^(?:javascript|data|vbscript):/i.test(raw)) return "";
  if (raw.startsWith("/")) return `${String(siteUrl || "").replace(/\/+$/, "")}${raw}`;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "sem data definida";
}

function dateTimeLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "sem data definida";
}

function templateContext(templateId) {
  return TEMPLATE_CONTEXTS[String(templateId || "")] || "relationship";
}

function audienceLabel(value) {
  return {
    all: "clientes com marketing ativo",
    active: "clientes ativos recentemente",
    recent: "clientes ativos recentemente",
    purchased: "clientes com compras aprovadas",
    reactivation: "clientes sem compra recente",
    birthday_manual: "clientes selecionados manualmente para aniversário",
    selected: "clientes selecionados manualmente"
  }[String(value || "all")] || "clientes com marketing ativo";
}

function couponLabel(coupon) {
  if (!coupon) return "";
  if (coupon.discountType === "percent") return `${Number(coupon.value || 0)}% de desconto`;
  if (coupon.discountType === "fixed_price") return `preço final de ${money(coupon.value)}`;
  return `${money(coupon.value)} de desconto`;
}

function movieSessions(movie) {
  return (movie?.sessions || [])
    .filter((session) => session.date && session.time)
    .slice(0, 6)
    .map((session) => [
      `${dateLabel(`${session.date}T12:00:00`)} às ${session.time}`,
      session.language || session.audio,
      session.format,
      session.roomName || session.room
    ].filter(Boolean).join(" · "))
    .join(" · ");
}

function planBenefits(plan) {
  const raw = Array.isArray(plan?.benefits) ? plan.benefits : String(plan?.benefits || "").split(/\n|,/);
  return raw.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
}

function movieLink(movie, siteUrl) {
  return movie ? safeUrl(`/filmes/${movie.slug || movie.id}`, siteUrl) : "";
}

function renderDetailRows({ movie, movies = [], coupon, plan, concessions, audience, siteUrl }) {
  const rows = [];
  const catalogMovies = movies.length ? movies : (movie ? [movie] : []);
  if (catalogMovies.length === 1) {
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Sessões</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(movieSessions(movie) || "Consulte a programação")}</td></tr>`);
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Duração e classificação</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml([movie.duration, movie.rating || movie.classification].filter(Boolean).join(" · ") || "Confira os detalhes")}</td></tr>`);
  } else if (catalogMovies.length > 1) {
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Filmes em destaque</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(catalogMovies.slice(0, 8).map((item) => item.title || "Filme").join(" · "))}</td></tr>`);
  }
  if (coupon) {
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Cupom</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right"><strong>${escapeHtml(coupon.couponCode || "CUPOM")}</strong> · ${escapeHtml(couponLabel(coupon))}</td></tr>`);
    if (coupon.startsAt) rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Disponível a partir de</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(dateLabel(coupon.startsAt))}</td></tr>`);
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Validade</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(dateLabel(coupon.endsAt))}</td></tr>`);
    const conditions = [
      coupon.appliesTo === "tickets" ? "somente ingressos" : coupon.appliesTo === "concessions" ? "somente bomboniere" : "ingressos e bomboniere",
      Number(coupon.minimumOrderValue || 0) > 0 ? `pedido mínimo de ${money(coupon.minimumOrderValue)}` : "",
      coupon.firstPurchaseOnly ? "exclusivo para primeira compra" : "",
      Number(coupon.perCustomerLimit || 0) > 0 ? `até ${Number(coupon.perCustomerLimit)} uso(s) por cliente` : ""
    ].filter(Boolean).join(" · ");
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Condições</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(conditions)}</td></tr>`);
  }
  if (plan) {
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Plano</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(plan.name || "Plano do Clube")} · ${escapeHtml(money(plan.monthlyPrice || plan.price || 0))}/mês</td></tr>`);
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Benefícios</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(planBenefits(plan).slice(0, 3).join(" · ") || `${Number(plan.includedTickets || 0)} ingresso(s) por ciclo`)}</td></tr>`);
  }
  if (concessions.length) {
    rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Na bomboniere</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(concessions.slice(0, 4).map((item) => `${item.name || "Item"} · ${money(item.price || 0)}`).join(" | "))}</td></tr>`);
  }
  rows.push(`<tr><td style="padding:8px 0;color:#9aa8bd;font-size:13px">Oferta para</td><td style="padding:8px 0;color:#f8fafc;font-size:13px;text-align:right">${escapeHtml(audienceLabel(audience))}</td></tr>`);
  return rows.join("");
}

function ctaIntentUrl(intent, { movie, coupon, siteUrl }) {
  const destination = {
    tickets: movieLink(movie, siteUrl) || safeUrl("/filmes", siteUrl),
    movie: movieLink(movie, siteUrl) || safeUrl("/filmes", siteUrl),
    programming: safeUrl("/filmes", siteUrl),
    trailer: safeUrl(movie?.trailerVideoUrl || movie?.localTrailerUrl || movie?.trailerSourceUrl || movieLink(movie, siteUrl), siteUrl),
    coupon: coupon?.appliesTo === "concessions" ? safeUrl("/filmes", siteUrl) : movieLink(movie, siteUrl) || safeUrl("/filmes", siteUrl),
    concession: safeUrl("/filmes", siteUrl),
    club: safeUrl("/clube", siteUrl),
    event: safeUrl("/eventos", siteUrl),
    account: safeUrl("/conta", siteUrl)
  };
  return destination[intent] || "";
}

function allowedButtonIntents(scenario, coupon) {
  if (["premiere", "now_playing", "last_chance", "programming"].includes(scenario)) return new Set(["tickets", "movie", "programming", "trailer"]);
  if (["coupon", "promotion"].includes(scenario)) return coupon?.appliesTo === "concessions"
    ? new Set(["coupon", "concession"])
    : new Set(["coupon", "tickets", "movie", "programming"]);
  if (["concession", "combo"].includes(scenario)) return new Set(["concession"]);
  if (["club", "club_plan"].includes(scenario)) return new Set(["club"]);
  if (scenario === "event") return new Set(["event"]);
  if (scenario === "ticket") return new Set(["account"]);
  if (["birthday", "reactivation"].includes(scenario)) return new Set(["programming", "account"]);
  return new Set(["programming", "event", "club", "account"]);
}

function campaignCtaButtons(buttons, fallback, context) {
  const allowed = allowedButtonIntents(context.scenario, context.coupon);
  const resolved = (Array.isArray(buttons) ? buttons : [])
    .map((button) => {
      const intent = String(button?.intent || "").trim();
      const label = safeText(button?.label, "", 80);
      const url = allowed.has(intent) ? ctaIntentUrl(intent, context) : "";
      return label && url ? { label, intent, url } : null;
    })
    .filter(Boolean)
    .filter((button, index, items) => items.findIndex((candidate) => candidate.intent === button.intent && candidate.label === button.label) === index)
    .slice(0, 3);
  return resolved.length ? resolved : [{ label: fallback.label, intent: fallback.intent, url: fallback.url }].filter((button) => button.label && button.url);
}

function mergeRequestedButtons(buttons, brief) {
  const requested = requestedButtonHints(brief).map(({ intent, label, explicit }) => ({
    intent,
    label: explicit && label ? label : {
      tickets: "Comprar ingressos",
      programming: "Ver programação",
      trailer: "Ver trailer",
      coupon: "Usar meu cupom",
      concession: "Ver bomboniere",
      club: "Conhecer o Clube",
      event: "Ver evento",
      account: "Acessar minha conta"
    }[intent] || "Saiba mais"
  }));
  const requestedIntents = new Set(requested.map((button) => button.intent));
  return [...requested, ...(Array.isArray(buttons) ? buttons : []).filter((button) => !requestedIntents.has(String(button?.intent || "")))].slice(0, 3);
}

function inferredArtDirection(brief, visualStyle) {
  const text = String(brief || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const motifs = [];
  if (/caixa|encomenda|etiqueta industrial|special delivery/.test(text)) motifs.push("package");
  if (/blueprint|planta tecnica|projeto tecnico|diagrama/.test(text)) motifs.push("blueprint");
  if (/estrada|trajetoria|linha pontilhada/.test(text)) motifs.push("road");
  if (/explos|impacto|dinamite|foguete|bigorna/.test(text)) motifs.push("impact");
  if (/ingresso|ticket/.test(text)) motifs.push("ticket");
  return {
    heroLayout: /assimetr|ao lado|proximo ao poster|pr[oó]ximo ao p[oô]ster/.test(text) ? "split" : "stacked",
    motifs: [...new Set(motifs)].slice(0, 3),
    offerCardStyle: motifs.includes("package") ? "package" : motifs.includes("blueprint") ? "blueprint" : "classic",
    dividerStyle: motifs.includes("road") ? "road" : motifs.includes("package") ? "tape" : "line",
    ctaPlacement: /cta\s+deve\s+aparecer|cta[\s\S]{0,900}(?:no hero|depois do card|proximo ao final|pr[oó]ximo ao final)/.test(text) ? "repeated" : "standard",
    visualStyle
  };
}

function normalizeArtDirection(value, brief, visualStyle) {
  const fallback = inferredArtDirection(brief, visualStyle);
  const source = value && typeof value === "object" ? value : {};
  const motifs = [...new Set([
    ...(Array.isArray(source.motifs) ? source.motifs : []),
    ...fallback.motifs
  ])].filter((item) => ART_MOTIFS.has(item)).slice(0, 3);
  return {
    heroLayout: fallback.heroLayout === "split" ? "split" : (["stacked", "split"].includes(source.heroLayout) ? source.heroLayout : fallback.heroLayout),
    motifs,
    offerCardStyle: fallback.offerCardStyle !== "classic" ? fallback.offerCardStyle : (["classic", "package", "blueprint", "ticket"].includes(source.offerCardStyle) ? source.offerCardStyle : fallback.offerCardStyle),
    dividerStyle: fallback.dividerStyle !== "line" ? fallback.dividerStyle : (["line", "dashed", "road", "tape"].includes(source.dividerStyle) ? source.dividerStyle : fallback.dividerStyle),
    ctaPlacement: fallback.ctaPlacement === "repeated" ? "repeated" : (["standard", "repeated"].includes(source.ctaPlacement) ? source.ctaPlacement : fallback.ctaPlacement),
    visualStyle
  };
}

function normalizeContentSections(value) {
  return (Array.isArray(value) ? value : []).map((section) => ({
    type: SECTION_TYPES.has(section?.type) ? section.type : "body",
    title: safeText(section?.title, "", 100),
    body: safeText(section?.body, "", 700, true),
    items: (Array.isArray(section?.items) ? section.items : []).map((item) => safeText(item, "", 180)).filter(Boolean).slice(0, 5)
  })).filter((section) => section.title || section.body || section.items.length).slice(0, 6);
}

function renderEmailButton(button, colors, secondary = false, index = 0) {
  if (!button?.label || !button?.url) return "";
  return `<a data-campaign-field="cta-label" data-campaign-cta-index="${index}" href="${escapeHtml(button.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:14px 20px;border:2px solid ${colors.button};border-radius:7px;background:${secondary ? "transparent" : colors.button};color:${secondary ? colors.headline : "#020617"};font-size:13px;font-weight:800;line-height:1.2;text-decoration:none">${escapeHtml(button.label)}</a>`;
}

function renderCtaGroup(buttons, colors, align, primaryOnly = false) {
  const visible = primaryOnly ? buttons.slice(0, 1) : buttons;
  return visible.length ? `<div style="padding-top:22px;text-align:${align}">${visible.map((button, index) => renderEmailButton(button, colors, index > 0, index)).join("")}</div>` : "";
}

function renderMotifDivider(style, colors) {
  if (style === "road") return `<div role="separator" style="margin:26px 0;border-top:3px dashed ${colors.accent};height:0"></div>`;
  if (style === "tape") return `<div role="separator" style="margin:24px 0;height:8px;background:${colors.button};opacity:.9"></div>`;
  return `<div role="separator" style="margin:24px 0;border-top:${style === "dashed" ? "2px dashed" : "1px solid"} ${colors.accent};opacity:.55"></div>`;
}

function couponDisplayValue(coupon) {
  if (!coupon) return "";
  if (coupon.discountType === "percent") return `${Number(coupon.value || 0)}% OFF`;
  if (coupon.discountType === "fixed_price") return `${money(coupon.value)} FINAL`;
  return `${money(coupon.value)} OFF`;
}

function renderOfferCard(coupon, artDirection, colors) {
  if (!coupon) return "";
  const packageStyle = artDirection.offerCardStyle === "package";
  const blueprintStyle = artDirection.offerCardStyle === "blueprint";
  const background = packageStyle ? "#f5e6c8" : blueprintStyle ? "#1d4ed8" : "#f8fafc";
  const foreground = blueprintStyle ? "#ffffff" : "#111827";
  const border = packageStyle ? `2px dashed ${colors.button}` : blueprintStyle ? "1px solid #93c5fd" : `2px solid ${colors.accent}`;
  const acmePackage = packageStyle && /^ACME/i.test(String(coupon.couponCode || ""));
  return `<div style="margin:24px 0;padding:22px;background:${background};border:${border};border-radius:8px;color:${foreground};text-align:center">
    <span style="display:block;margin-bottom:8px;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">${acmePackage ? "ACME Special Delivery" : packageStyle ? "Entrega especial" : blueprintStyle ? "Oferta planejada" : "Condição especial"}</span>
    <strong style="display:block;font-size:38px;line-height:1;color:${packageStyle ? "#b91c1c" : foreground}">${escapeHtml(couponDisplayValue(coupon))}</strong>
    <span style="display:block;margin-top:14px;font-size:12px;text-transform:uppercase">Cupom</span>
    <strong style="display:block;margin-top:3px;font-size:24px;letter-spacing:1.5px">${escapeHtml(coupon.couponCode || "CUPOM")}</strong>
    ${acmePackage ? `<span style="display:inline-block;margin:14px 5px 0;padding:4px 8px;border:2px solid #b91c1c;color:#b91c1c;font-size:10px;font-weight:900;letter-spacing:1px">FRÁGIL</span><span style="display:inline-block;margin:14px 5px 0;padding:4px 8px;border:2px solid #111827;color:#111827;font-size:10px;font-weight:900;letter-spacing:1px">CUIDADO</span><span aria-hidden="true" style="display:block;margin-top:10px;color:#111827;font-family:monospace;font-size:16px;letter-spacing:2px">|||| || ||||| | ||||</span>` : ""}
    <span style="display:block;margin-top:14px;padding-top:12px;border-top:1px dashed ${blueprintStyle ? "#bfdbfe" : "#64748b"};font-size:13px;font-weight:800">Válido até ${escapeHtml(dateTimeLabel(coupon.endsAt))}</span>
  </div>`;
}

function renderCreativeSections(sections, artDirection, colors, coupon, movie) {
  const normalized = [...sections];
  if (artDirection.motifs.includes("blueprint") && !normalized.some((section) => section.type === "steps")) {
    const codeNumber = String(coupon?.couponCode || "").match(/(\d+)/)?.[1] || "";
    normalized.unshift({
      type: "steps",
      title: codeNumber && /^ACME/i.test(String(coupon?.couponCode || "")) ? `PLANO ACME Nº ${codeNumber}` : coupon?.couponCode ? `Plano ${coupon.couponCode}` : "Plano para aproveitar a oferta",
      body: /^ACME/i.test(String(coupon?.couponCode || "")) ? "O que poderia dar errado?" : "",
      items: ["Escolha uma sessão disponível", `Use o cupom ${coupon?.couponCode || "selecionado"}`, `Receba ${coupon ? couponLabel(coupon) : "a condição anunciada"}`, movie?.title ? `Assista ${movie.title}` : "Conclua a compra no site"]
    });
  }
  return normalized.slice(0, 6).map((section) => {
    if (section.type === "steps") {
      const rows = section.items.map((item, index) => `<tr><td width="34" valign="top" style="width:34px;padding:7px 10px 7px 0;color:#bfdbfe;font-size:12px;font-weight:900">${index + 1}</td><td style="padding:7px 0;border-bottom:1px solid rgba(191,219,254,.28);color:#ffffff;font-size:14px">${escapeHtml(item)}</td></tr>`).join("");
      return `<div style="margin:24px 0;padding:22px;background:#1d4ed8;border:1px solid #93c5fd;border-radius:8px"><strong style="display:block;color:#ffffff;font-size:19px">${escapeHtml(section.title || "Como funciona")}</strong>${section.body ? `<p style="margin:8px 0 0;color:#dbeafe;font-size:14px;line-height:1.55">${escapeHtml(section.body)}</p>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${rows}</table></div>`;
    }
    if (section.type === "quote") return `<div style="margin:24px 0;padding:18px 20px;border-top:2px solid ${colors.accent};border-bottom:2px solid ${colors.accent};color:${colors.headline};font-size:20px;font-weight:800;line-height:1.35;text-align:center">${escapeHtml(section.body || section.title)}</div>`;
    if (section.type === "highlight") return `<div style="margin:22px 0;padding:18px;background:${artDirection.motifs.includes("package") ? "#f5e6c8" : "#172235"};border-radius:8px;color:${artDirection.motifs.includes("package") ? "#111827" : colors.text}"><strong style="display:block;margin-bottom:7px;color:${artDirection.motifs.includes("package") ? "#b91c1c" : colors.headline};font-size:18px">${escapeHtml(section.title)}</strong><div style="font-size:14px;line-height:1.6">${escapeHtml(section.body).replace(/\n/g, "<br>")}</div></div>`;
    return `<div style="margin:22px 0"><strong style="display:block;margin-bottom:7px;color:${colors.headline};font-size:19px">${escapeHtml(section.title)}</strong><div style="color:${colors.text};font-size:14px;line-height:1.65">${escapeHtml(section.body).replace(/\n/g, "<br>")}</div></div>`;
  }).join("");
}

function renderHtml({ brand, kicker, headline, message, imageUrl, imageAlt, imageLink, details, ctaButtons, colors, visual, siteUrl, artDirection, contentSections, coupon, movie }) {
  const safeImage = safeUrl(imageUrl, siteUrl);
  const safeImageLink = safeUrl(imageLink, siteUrl);
  const logo = safeUrl(brand.logoUrl, siteUrl);
  const image = safeImage
    ? `${safeImageLink ? `<a href="${escapeHtml(safeImageLink)}" style="text-decoration:none">` : ""}<img data-campaign-field="image" src="${escapeHtml(safeImage)}" alt="${escapeHtml(imageAlt)}" style="display:block;width:100%;max-width:${visual.imageWidth}px;height:auto;max-height:410px;object-fit:contain;margin:0 auto;border-radius:${visual.imageRadius}px;background-color:transparent;border:0">${safeImageLink ? "</a>" : ""}`
    : "";
  const titleBlock = `<div style="color:${colors.accent};font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;text-align:${visual.align}">${escapeHtml(kicker)}</div><h1 data-campaign-field="headline" style="margin:10px 0 16px;color:${colors.headline};font-size:32px;line-height:1.12;text-align:${visual.align}">${escapeHtml(headline)}</h1>`;
  const repeated = artDirection.ctaPlacement === "repeated";
  const hero = artDirection.heroLayout === "split" && image
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed"><tr><td class="cine-hero-copy" width="55%" valign="middle" style="width:55%;padding:8px 22px 8px 0">${titleBlock}${repeated ? renderCtaGroup(ctaButtons, colors, visual.align, true) : ""}</td><td class="cine-hero-image" width="45%" valign="middle" style="width:45%;padding:0">${image}</td></tr></table>`
    : `${titleBlock}${image ? `<div style="padding:0 0 22px;text-align:center">${image}</div>` : ""}${repeated ? renderCtaGroup(ctaButtons, colors, visual.align, true) : ""}`;
  const offerCard = renderOfferCard(coupon, artDirection, colors);
  const sections = renderCreativeSections(contentSections, artDirection, colors, coupon, movie);
  const firstRepeat = repeated && offerCard ? renderCtaGroup(ctaButtons, colors, "center", true) : "";
  const finalCta = renderCtaGroup(ctaButtons, colors, visual.align);
  return `<style>@media screen and (max-width:640px){.cine-hero-copy,.cine-hero-image{display:block!important;width:100%!important;box-sizing:border-box!important}.cine-hero-copy{padding:0 0 20px!important}.cine-email-pad{padding:22px 18px!important}}</style><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;background:${visual.background};font-family:Arial,sans-serif;color:${colors.text}"><tr><td class="cine-email-pad" style="padding:24px 26px;background:${visual.header}">${logo ? `<img data-campaign-field="logo" src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name)}" style="display:block;width:126px;max-height:58px;object-fit:contain;margin:0;background-color:transparent;border:0">` : `<strong style="color:${colors.accent};font-size:15px">${escapeHtml(brand.name)}</strong>`}<div style="padding-top:8px;color:#93a4bd;font-size:12px">${escapeHtml(brand.tagline)}</div></td></tr><tr><td class="cine-email-pad" style="padding:28px 26px;background:${visual.content};background-color:${visual.content}">${hero}<div data-campaign-field="message" style="margin-top:20px;color:${colors.text};font-size:16px;line-height:1.65">${escapeHtml(message).replace(/\n/g, "<br>")}</div>${offerCard}${firstRepeat}${renderMotifDivider(artDirection.dividerStyle, colors)}${sections}${details ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border-top:1px solid rgba(148,163,184,.28)">${details}</table>` : ""}${finalCta}</td></tr><tr><td data-campaign-field="footer" class="cine-email-pad" style="padding:18px 26px;color:#93a4bd;font-size:11px;line-height:1.5;border-top:1px solid rgba(148,163,184,.18);background:${visual.header}">${escapeHtml(brand.footer)}</td></tr></table>`;
}

function buildCampaignDraft(input = {}) {
  input = scopeCampaignContext(input);
  const resolvedScenario = resolveCampaignTemplate(input).scenario;
  const scenario = SCENARIO_DEFAULTS[resolvedScenario] ? resolvedScenario : normalizeScenario(input.scenario || input.aiScenario || "announcement");
  const defaults = SCENARIO_DEFAULTS[scenario];
  const siteUrl = String(input.siteUrl || "").replace(/\/+$/, "");
  const movies = Array.isArray(input.movies) ? input.movies.filter(Boolean).slice(0, 20) : [];
  const movie = input.movie || movies[0] || null;
  const coupon = input.coupon || null;
  const plan = input.plan || null;
  const concessions = Array.isArray(input.concessions) ? input.concessions.filter(Boolean) : [];
  const reference = input.referenceCampaign || {};
  const requestedTemplate = validTemplate(input.referenceTemplateId || reference.templateId, defaults.templateId);
  const templateId = isTemplateCompatibleWithScenario(scenario, requestedTemplate) ? requestedTemplate : defaults.templateId;
  const usableReference = reference.id && reference.templateId === templateId ? reference : {};
  const referenceColors = usableReference.headlineColor || usableReference.textColor || usableReference.buttonColor || usableReference.accentColor ? usableReference : {};
  const creative = input.creative && typeof input.creative === "object" ? input.creative : {};
  const visualStyle = resolveVisualStyle(usableReference.visualStyle || visualStyleFromBrief(input.brief) || creative.visualStyle || input.visualStyle, scenario);
  const visual = VISUAL_STYLE_PRESETS[visualStyle];
  const referenceLocked = Boolean(usableReference.id);
  const artDirection = normalizeArtDirection(referenceLocked ? usableReference.artDirection : creative.artDirection, input.brief, visualStyle);
  const contentSections = normalizeContentSections(referenceLocked ? usableReference.contentSections : creative.sections);
  const colors = {
    accent: referenceLocked
      ? safeColor(referenceColors.accentColor, visual.accent || defaults.accent)
      : brandSafeColor(creative.accentColor, safeColor(input.accentColor, visual.accent || defaults.accent)),
    headline: referenceLocked
      ? safeColor(referenceColors.headlineColor, visual.headline)
      : brandSafeColor(creative.headlineColor, visual.headline),
    text: referenceLocked
      ? safeColor(referenceColors.textColor, visual.text)
      : brandSafeColor(creative.textColor, visual.text),
    button: referenceLocked
      ? safeColor(referenceColors.buttonColor, visual.accent || defaults.accent)
      : brandSafeColor(creative.buttonColor, visual.accent || defaults.accent)
  };
  const brand = {
    name: String(input.brand?.name || "Cine Cruzeiro").trim().slice(0, 80),
    logoUrl: String(input.brand?.logoUrl || "").trim().slice(0, 1000),
    tagline: String(input.brand?.tagline || "Mensagem automática do Cine Cruzeiro.").trim().slice(0, 180),
    footer: String(input.brand?.footer || "Mensagem automática do Cine Cruzeiro.").trim().slice(0, 400)
  };
  const subjectMovie = movie?.title ? `: ${movie.title}` : "";
  const fallbackSubject = {
    announcement: "Uma novidade do Cine Cruzeiro para você",
    programming: "Confira a programação do Cine Cruzeiro",
    premiere: `Grande estreia${subjectMovie} no Cine Cruzeiro`,
    now_playing: `${movie?.title || "Novidades"} já está em cartaz`,
    last_chance: `Últimos dias${subjectMovie ? ` para assistir${subjectMovie}` : " no Cine Cruzeiro"}`,
    promotion: coupon ? `${coupon.title || "Oferta especial"} no Cine Cruzeiro` : "Uma oferta especial para você",
    coupon: coupon ? `Seu cupom ${coupon.couponCode || "exclusivo"} está esperando` : "Um cupom especial do Cine Cruzeiro",
    club: plan ? `${plan.name || "Clube Cine Cruzeiro"}: mais vantagens para você` : "Conheça as vantagens do Clube Cine Cruzeiro",
    concession: concessions[0]?.name ? `${concessions[0].name} para deixar sua sessão melhor` : "Novidades na bomboniere",
    combo: "Um combo especial para sua próxima sessão",
    club_plan: plan ? `${plan.name}: mais cinema para você` : "Conheça os planos do Clube Cine Cruzeiro",
    birthday: "Seu aniversário merece uma sessão especial",
    event: "Um evento especial está chegando ao Cine Cruzeiro",
    ticket: movie ? `Informações dos ingressos para ${movie.title}` : "Informações sobre seus ingressos",
    reactivation: "Sentimos sua falta no Cine Cruzeiro"
  }[scenario];
  const fallbackHeadline = movie?.title && ["premiere", "now_playing", "last_chance"].includes(scenario)
    ? scenario === "last_chance" ? `Últimas sessões de ${movie.title}` : scenario === "premiere" ? `${movie.title} está chegando` : `${movie.title} está em cartaz`
    : defaults.headline;
  const fallbackMessage = briefOpening(input.brief)
    ? `Olá, {{nome}}. ${briefOpening(input.brief)}`
    : scenario === "premiere" && movie
      ? `Olá, {{nome}}. Prepare-se para viver ${movie.title} na tela grande. Consulte as sessões e escolha seu melhor horário.`
      : scenario === "now_playing" && movie
        ? `Olá, {{nome}}. ${movie.title} já está em cartaz no Cine Cruzeiro. Venha viver essa história com a gente.`
        : scenario === "last_chance" && movie
          ? `Olá, {{nome}}. As últimas sessões de ${movie.title} estão passando. Garanta seu ingresso antes que a temporada termine.`
          : scenario === "coupon" && coupon
            ? `Olá, {{nome}}. Preparamos ${couponLabel(coupon)} para você aproveitar no Cine Cruzeiro.`
            : ["club", "club_plan"].includes(scenario) && plan
              ? `Olá, {{nome}}. O ${plan.name || "Clube Cine Cruzeiro"} reúne benefícios para você aproveitar mais sessões, bomboniere e momentos especiais.`
              : ["concession", "combo"].includes(scenario) && concessions.length
                ? `Olá, {{nome}}. Conheça ${concessions[0].name || "as novidades da bomboniere"} e complete sua próxima sessão.`
                : scenario === "birthday"
                  ? "Olá, {{nome}}. O Cine Cruzeiro deseja um feliz aniversário e uma nova história para celebrar na tela grande."
                  : scenario === "programming"
                    ? "Olá, {{nome}}. Confira os filmes e horários disponíveis e escolha sua próxima sessão no Cine Cruzeiro."
                    : scenario === "ticket"
                  ? `Olá, {{nome}}. Seus ingressos ficam disponíveis na sua conta. Confira QR Code, sessão e poltrona antes de chegar ao Cine Cruzeiro.`
                  : `Olá, {{nome}}. ${defaults.headline}. Preparamos esta novidade pensando em você.`;
  const subject = safeText(creative.subject, fallbackSubject, 180);
  const headline = safeText(creative.headline, fallbackHeadline, 180);
  const message = safeText(creative.message, fallbackMessage, 4000, true);
  const kicker = safeText(creative.kicker, defaults.kicker, 80);
  const preheader = safeText(creative.preheader, movie ? `${movie.title} · ${defaults.kicker} · Cine Cruzeiro` : `${defaults.kicker} · Cine Cruzeiro`, 140);
  const imageUrl = movie?.posterUrl || plan?.imageUrl || concessions[0]?.imageUrl || input.imageUrl || "";
  const imageAlt = movie ? `Pôster de ${movie.title}` : plan ? `Imagem do ${plan.name}` : concessions[0] ? `Imagem de ${concessions[0].name}` : "Imagem da campanha";
  const imageLink = movieLink(movie, siteUrl) || (plan ? safeUrl(`/clube/assinar/${plan.id}`, siteUrl) : safeUrl("/filmes", siteUrl));
  const ctaLabel = safeText(creative.ctaLabel, defaults.ctaLabel, 80);
  const defaultIntent = ["club", "club_plan"].includes(scenario) ? "club"
    : scenario === "event" ? "event"
      : scenario === "ticket" ? "account"
        : ["concession", "combo"].includes(scenario) ? "concession"
          : ["coupon", "promotion"].includes(scenario) ? "coupon"
            : scenario === "programming" ? "programming" : "tickets";
  const ctaButtons = campaignCtaButtons(mergeRequestedButtons(creative.buttons, input.brief), {
    label: ctaLabel,
    intent: defaultIntent,
    url: ctaIntentUrl(defaultIntent, { movie, coupon, siteUrl }) || imageLink || safeUrl("/filmes", siteUrl)
  }, { scenario, movie, coupon, siteUrl });
  const primaryCta = ctaButtons[0] || { label: ctaLabel, url: imageLink || safeUrl("/filmes", siteUrl) };
  const audience = input.recipientMode || "all";
  const details = renderDetailRows({ movie, movies, coupon, plan, concessions, audience, siteUrl });
  const variables = {
    nome_filme: movie?.title || "",
    link_filme: movieLink(movie, siteUrl),
    sessoes_filme: movieSessions(movie),
    duracao_filme: movie?.duration || "",
    classificacao_filme: movie?.rating || movie?.classification || "",
    codigo_cupom: coupon?.couponCode || "",
    titulo_cupom: coupon?.title || "",
    desconto_cupom: couponLabel(coupon),
    validade_cupom: coupon?.endsAt ? dateLabel(coupon.endsAt) : "",
    validade_oferta: coupon?.endsAt ? dateLabel(coupon.endsAt) : "",
    publico_oferta: audienceLabel(audience),
    nome_plano: plan?.name || "",
    preco_plano: plan ? `${money(plan.monthlyPrice || plan.price || 0)}/mês` : "",
    creditos_clube: plan ? String(plan.includedTickets || 0) : "",
    beneficios_clube: plan ? planBenefits(plan).join(" · ") : "",
    imagem_plano: plan?.imageUrl || "",
    link_plano: plan ? safeUrl(`/clube/assinar/${plan.id}`, siteUrl) : "",
    nome_item: concessions[0]?.name || "",
    descricao_item: concessions[0]?.description || "",
    preco_item: concessions[0] ? money(concessions[0].price || 0) : "",
    itens_bomboniere: concessions.map((item) => `${item.name || "Item"} (${money(item.price || 0)})`).join(" · ")
  };
  return {
    subject,
    preheader,
    kicker,
    headline,
    message,
    html: renderHtml({ brand, kicker, headline, message, imageUrl, imageAlt, imageLink, details, ctaButtons, colors, visual, siteUrl, artDirection, contentSections, coupon, movie }),
    mode: "template",
    templateId,
    ctaLabel: primaryCta.label,
    ctaUrl: primaryCta.url,
    ctaButtons,
    recipientMode: audience === "active" ? "recent" : ["all", "recent", "purchased", "reactivation", "birthday_manual", "selected"].includes(audience) ? audience : "all",
    couponId: coupon?.id || "",
    movieId: movie?.id || "",
    clubPlanId: plan?.id || "",
    concessionId: concessions[0]?.id || "",
    concessionIds: concessions.map((item) => item.id).filter(Boolean).slice(0, 20),
    imageUrl,
    imageAlt,
    imageLink,
    headlineColor: colors.headline,
    textColor: colors.text,
    buttonColor: colors.button,
    accentColor: colors.accent,
    visualStyle,
    visualStyleLabel: visual.label,
    artDirection,
    contentSections,
    scheduleAt: input.scheduleAt || "",
    variables,
    brand,
    aiGenerated: true,
    aiProvider: "",
    aiScenario: scenario,
    aiContext: templateContext(templateId),
    aiCompatibleTemplates: compatibleTemplatesForScenario(scenario),
    aiReferenceCampaignId: usableReference.id || "",
    aiReferenceTemplateId: templateId,
    aiBrief: String(input.brief || "").trim().slice(0, 12000)
  };
}

module.exports = {
  buildCampaignDraft,
  normalizeScenario,
  _test: {
    buildCampaignDraft,
    compatibleTemplatesForScenario,
    escapeHtml,
    normalizeScenario,
    resolveVisualStyle,
    templateContext,
    mergeRequestedButtons,
    normalizeArtDirection,
    normalizeContentSections,
    renderHtml
  }
};
