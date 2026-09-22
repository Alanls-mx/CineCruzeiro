const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function fontData(filename) {
  try {
    return fs.readFileSync(path.join(__dirname, "..", "..", "public", "fonts", "social-studio", filename)).toString("base64");
  } catch {
    return "";
  }
}

const SOCIAL_DISPLAY_FONT = fontData("BarlowCondensed-Black.ttf");
const SOCIAL_TEXT_FONT = fontData("BarlowCondensed-SemiBold.ttf");
const SOCIAL_DISPLAY_FAMILY = "Social Poster Display, DejaVu Sans Condensed, sans-serif";
const SOCIAL_TEXT_FAMILY = "Social Poster Text, Arial, sans-serif";

const SOCIAL_FORMATS = Object.freeze({
  feed_portrait: { id: "feed_portrait", name: "Instagram Feed 4:5", width: 1080, height: 1350 },
  square: { id: "square", name: "Instagram/Facebook quadrado", width: 1080, height: 1080 },
  story: { id: "story", name: "Instagram Stories", width: 1080, height: 1920 }
});

const MOVIE_STYLES = Object.freeze(["cinematic", "impact", "clean", "minimal"]);
const TEMPLATE_FIELDS = Object.freeze({
  "movie-price": ["movie", "title", "subtitle", "price", "auxiliaryText", "cta", "image", "advanced", "caption"],
  "movie-highlight": ["movie", "title", "subtitle", "date", "auxiliaryText", "cta", "image", "advanced", "caption"],
  "movie-premiere": ["movie", "title", "subtitle", "date", "auxiliaryText", "cta", "image", "advanced", "caption"],
  "online-ticket": ["title", "subtitle", "auxiliaryText", "cta", "image", "advanced", "caption"],
  "concession-combo": ["concession", "title", "subtitle", "price", "auxiliaryText", "cta", "image", "advanced", "caption"],
  "cinema-club": ["clubPlan", "title", "subtitle", "price", "auxiliaryText", "cta", "image", "advanced", "caption"]
});

const SOCIAL_TEMPLATES = Object.freeze([
  { id: "movie-price", name: "Ingresso + preço", type: "movie", category: "FILMES", description: "Preço em primeiro plano, filme e chamada para compra.", requiredData: ["movie"], fields: TEMPLATE_FIELDS["movie-price"], styles: MOVIE_STYLES, formats: Object.keys(SOCIAL_FORMATS) },
  { id: "movie-highlight", name: "Filme em destaque", type: "movie", category: "FILMES", description: "Imagem protagonista, sessões e título com presença.", requiredData: ["movie"], fields: TEMPLATE_FIELDS["movie-highlight"], styles: MOVIE_STYLES, formats: Object.keys(SOCIAL_FORMATS) },
  { id: "movie-premiere", name: "Estreia da semana", type: "movie", category: "FILMES", description: "Lançamento com data, horários e clima cinematográfico.", requiredData: ["movie"], fields: TEMPLATE_FIELDS["movie-premiere"], styles: MOVIE_STYLES, formats: Object.keys(SOCIAL_FORMATS) },
  { id: "online-ticket", name: "Compre online", type: "institutional", category: "VENDAS", description: "Fluxo de compra digital com chamada institucional.", requiredData: [], fields: TEMPLATE_FIELDS["online-ticket"], styles: ["clean", "impact"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "concession-combo", name: "Produto ou combo", type: "concession", category: "BOMBONIERE", description: "Produto real, composição e preço da bomboniere.", requiredData: ["concession"], fields: TEMPLATE_FIELDS["concession-combo"], styles: ["impact", "clean"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "cinema-club", name: "Plano do clube", type: "club", category: "CLUBE", description: "Plano, benefícios e mensalidade cadastrados.", requiredData: ["clubPlan"], fields: TEMPLATE_FIELDS["cinema-club"], styles: ["cinematic", "clean"], formats: Object.keys(SOCIAL_FORMATS) }
]);

const SOCIAL_STYLES = Object.freeze([
  { id: "cinematic", name: "Cartaz cinematográfico" },
  { id: "impact", name: "Impacto" },
  { id: "clean", name: "Clean" },
  { id: "minimal", name: "Minimalista" }
]);

const SOCIAL_SIGNATURES = Object.freeze([
  { id: "automatic", name: "Automática", description: "Escolhe a assinatura mais adequada ao modelo.", imageUrl: "" },
  { id: "classic", name: "Marca clássica", description: "Mantém a logo já usada pelo Cine Cruzeiro.", imageUrl: "" },
  { id: "icon-3d", name: "Símbolo 3D", description: "Assinatura compacta para ofertas e chamadas diretas.", imageUrl: "/images/social-studio/cine-cruzeiro-icon-3d.png" },
  { id: "wordmark-3d", name: "Assinatura horizontal", description: "Nome completo com boa leitura sobre imagens.", imageUrl: "/images/social-studio/cine-cruzeiro-wordmark-3d.png" },
  { id: "logo-3d", name: "Logo completa 3D", description: "Versão institucional com Cultura e Lazer.", imageUrl: "/images/social-studio/cine-cruzeiro-logo-3d.png" },
  { id: "none", name: "Sem assinatura", description: "Oculta a marca desta composição.", imageUrl: "" }
]);

const FALLBACK_BRAND = Object.freeze({
  name: "Cinema",
  logoUrl: "",
  website: "",
  posterWebsite: "",
  posterLogoUrl: "",
  primaryColor: "#07111f",
  secondaryColor: "#1d4ed8",
  accentColor: "#facc15",
  textColor: "#ffffff"
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function xml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeHex(value, fallback) {
  const candidate = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function hexToRgb(value) {
  const hex = safeHex(value, "#000000").slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const channel = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mixHex(from, to, amount = 0.5) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ratio = clamp(amount, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio
  });
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function normalizeBrand(brand = {}) {
  return {
    name: String(brand.name || FALLBACK_BRAND.name).trim().slice(0, 80),
    logoUrl: String(brand.logoUrl || "").trim().slice(0, 2000),
    website: String(brand.website || "").trim().slice(0, 500),
    posterWebsite: String(brand.posterWebsite || "").trim().slice(0, 180),
    posterLogoUrl: String(brand.posterLogoUrl || "").trim().slice(0, 2000),
    primaryColor: safeHex(brand.primaryColor, FALLBACK_BRAND.primaryColor),
    secondaryColor: safeHex(brand.secondaryColor, FALLBACK_BRAND.secondaryColor),
    accentColor: safeHex(brand.accentColor, FALLBACK_BRAND.accentColor),
    textColor: safeHex(brand.textColor, FALLBACK_BRAND.textColor)
  };
}

function templateById(id) {
  return SOCIAL_TEMPLATES.find((item) => item.id === id) || SOCIAL_TEMPLATES[0];
}

function formatById(id) {
  return SOCIAL_FORMATS[id] || SOCIAL_FORMATS.feed_portrait;
}

function entityById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => String(item.id) === String(id)) || null;
}

function minimumMoviePrice(movie = {}) {
  const direct = Number(movie.minimumPrice);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const prices = (movie.sessions || [])
    .flatMap((session) => session.ticketTypes || [])
    .map((ticket) => Number(ticket.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

function movieSessionTimes(movie = {}) {
  const seen = new Set();
  return (movie.sessions || [])
    .filter((session) => session.availableForPurchase !== false)
    .sort((a, b) => String(a.startsAt || `${a.date}T${a.time}`).localeCompare(String(b.startsAt || `${b.date}T${b.time}`)))
    .map((session) => String(session.time || "").slice(0, 5))
    .filter((time) => time && !seen.has(time) && seen.add(time))
    .slice(0, 5);
}

function defaultCopy(templateId, context = {}, entities = {}) {
  const movie = entities.movie || {};
  const concession = entities.concession || {};
  const plan = entities.clubPlan || {};
  const price = minimumMoviePrice(movie);
  const firstSession = (movie.sessions || [])[0] || {};
  const times = movieSessionTimes(movie);
  const cinemaName = context.brand?.name || "Cinema";
  const editorialMovie = movie.catalogued === false;
  const defaults = {
    "movie-price": {
      title: movie.title || "Filme em destaque",
      subtitle: "INGRESSO A PARTIR DE",
      cta: "COMPRE AGORA",
      price: price === null ? "CONSULTE OS VALORES" : formatMoney(price),
      date: formatDate(firstSession.date),
      auxiliaryText: times.length ? times.join("  •  ") : "Confira a programação"
    },
    "movie-highlight": {
      title: movie.title || "Hoje no cinema",
      subtitle: `HOJE NO ${cinemaName}`.toUpperCase(),
      cta: "GARANTA SEU LUGAR",
      price: price === null ? "" : `A partir de ${formatMoney(price)}`,
      date: formatDate(firstSession.date),
      auxiliaryText: times.length ? times.join("  •  ") : "Confira as sessões no site"
    },
    "movie-premiere": {
      title: movie.title || "Nova estreia",
      subtitle: editorialMovie ? "PRÓXIMO LANÇAMENTO" : "ESTREIA ESTA SEMANA",
      cta: editorialMovie ? "ACOMPANHE AS NOVIDADES" : "VER SESSÕES",
      price: price === null ? "" : `Ingressos a partir de ${formatMoney(price)}`,
      date: editorialMovie ? String(movie.releaseLabel || formatDate(movie.releaseDate)) : formatDate(movie.releaseDate || firstSession.date),
      auxiliaryText: editorialMovie ? String(movie.socialHook || "Acompanhe as novidades do cinema") : (times.length ? times.join("  •  ") : "Programação no site")
    },
    "online-ticket": {
      title: "Compre seu ingresso de forma fácil e rápida",
      subtitle: "BILHETERIA DIGITAL",
      cta: "ACESSE O SITE",
      price: "",
      date: "",
      auxiliaryText: "Escolha o filme  •  Escolha seu lugar  •  Compre online"
    },
    "concession-combo": {
      title: concession.name || "Oferta da bomboniere",
      subtitle: "SABOR PARA A SUA SESSÃO",
      cta: "ADICIONE AO PEDIDO",
      price: Number.isFinite(Number(concession.price)) && Number(concession.price) > 0 ? formatMoney(concession.price) : "CONSULTE O VALOR",
      date: "",
      auxiliaryText: concession.description || "Peça junto com seu ingresso"
    },
    "cinema-club": {
      title: plan.name || "Clube do Cinema",
      subtitle: "CINEMA TODO MÊS",
      cta: "CONHEÇA O CLUBE",
      price: Number.isFinite(Number(plan.monthlyPrice)) && Number(plan.monthlyPrice) > 0 ? `${formatMoney(plan.monthlyPrice)} / mês` : "CONHEÇA OS PLANOS",
      date: "",
      auxiliaryText: (plan.benefits || []).slice(0, 3).join("  •  ") || "Ingressos e benefícios em uma só assinatura"
    }
  };
  return defaults[templateId] || defaults["movie-price"];
}

function normalizeDraft(input = {}, context = {}) {
  const template = templateById(input.templateId);
  const format = formatById(input.formatId);
  const entities = {
    movie: entityById(context.movies, input.movieId) || context.movies?.[0] || null,
    concession: entityById(context.concessions, input.concessionId) || context.concessions?.[0] || null,
    clubPlan: entityById(context.clubPlans, input.clubPlanId) || context.clubPlans?.[0] || null
  };
  const defaults = defaultCopy(template.id, context, entities);
  const clean = (value, fallback, max) => String(value === undefined || value === null ? fallback : value).trim().slice(0, max);
  const supportedStyles = template.styles || ["clean"];
  const requestedStyle = clean(input.style, supportedStyles[0], 24);
  const imageMode = ["automatic", "backdrop", "poster", "upload"].includes(input.imageMode) ? input.imageMode : "automatic";
  const imagePreset = ["automatic", "center", "left", "right", "top", "bottom"].includes(input.imagePreset) ? input.imagePreset : "automatic";
  const signatureId = SOCIAL_SIGNATURES.some((item) => item.id === input.signatureId) ? input.signatureId : "automatic";
  return {
    templateId: template.id,
    formatId: format.id,
    outputType: input.outputType === "jpg" ? "jpg" : "png",
    style: supportedStyles.includes(requestedStyle) ? requestedStyle : supportedStyles[0],
    movieId: entities.movie?.id || "",
    concessionId: entities.concession?.id || "",
    clubPlanId: entities.clubPlan?.id || "",
    title: clean(input.title, defaults.title, 160),
    subtitle: clean(input.subtitle, defaults.subtitle, 120),
    cta: clean(input.cta, defaults.cta, 60),
    price: clean(input.price, defaults.price, 60),
    date: clean(input.date, defaults.date, 60),
    auxiliaryText: clean(input.auxiliaryText, defaults.auxiliaryText, 260),
    imageUrl: clean(input.imageUrl, "", 2000),
    imageMode,
    imagePreset,
    imagePositionX: clamp(input.imagePositionX === undefined ? 50 : input.imagePositionX, 0, 100),
    imagePositionY: clamp(input.imagePositionY === undefined ? 50 : input.imagePositionY, 0, 100),
    imageScale: clamp(input.imageScale === undefined ? 100 : input.imageScale, 100, 180),
    overlayIntensity: clamp(input.overlayIntensity === undefined ? 72 : input.overlayIntensity, 20, 100),
    darken: clamp(input.darken === undefined ? 8 : input.darken, 0, 55),
    blur: clamp(input.blur, 0, 16),
    contentPosition: ["top", "center", "bottom"].includes(input.contentPosition) ? input.contentPosition : "bottom",
    alignment: input.alignment === "center" ? "center" : "left",
    titleScale: clamp(input.titleScale === undefined ? 100 : input.titleScale, 80, 125),
    paletteMode: ["automatic", "brand", "dynamic"].includes(input.paletteMode) ? input.paletteMode : "automatic",
    signatureId,
    signaturePosition: ["automatic", "top-left", "top-center", "top-right", "bottom-center", "bottom-right"].includes(input.signaturePosition) ? input.signaturePosition : "automatic",
    signatureScale: clamp(input.signatureScale === undefined ? 100 : input.signatureScale, 70, 135),
    caption: clean(input.caption, "", 1800),
    entities
  };
}

function signatureForDraft(draft = {}, context = {}) {
  const automaticByTemplate = {
    "movie-price": "logo-3d",
    "movie-highlight": "logo-3d",
    "movie-premiere": "logo-3d",
    "online-ticket": "logo-3d",
    "concession-combo": "icon-3d",
    "cinema-club": "logo-3d"
  };
  const requestedId = draft.signatureId === "automatic"
    ? automaticByTemplate[draft.templateId] || "wordmark-3d"
    : draft.signatureId;
  const signature = SOCIAL_SIGNATURES.find((item) => item.id === requestedId) || SOCIAL_SIGNATURES[1];
  if (signature.id === "none") return null;
  if (signature.id === "classic") {
    const imageUrl = String(context.brand?.logoUrl || "").trim();
    return imageUrl ? { ...signature, imageUrl } : SOCIAL_SIGNATURES.find((item) => item.id === "wordmark-3d");
  }
  return signature;
}

function sourceImageForDraft(draft) {
  if (draft.imageMode === "upload" && draft.imageUrl) return draft.imageUrl;
  if (["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId)) {
    const movie = draft.entities.movie || {};
    if (draft.imageMode === "backdrop") return movie.backdropUrl || movie.posterUrl || "";
    if (draft.imageMode === "poster") return movie.posterUrl || movie.backdropUrl || "";
    if (draft.imageUrl) return draft.imageUrl;
    if (draft.style === "cinematic") return movie.posterUrl || movie.backdropUrl || "";
    return draft.formatId === "story"
      ? movie.posterUrl || movie.backdropUrl || ""
      : movie.backdropUrl || movie.posterUrl || "";
  }
  if (draft.imageUrl) return draft.imageUrl;
  if (draft.templateId === "concession-combo") return draft.entities.concession?.imageUrl || "";
  if (draft.templateId === "cinema-club") return draft.entities.clubPlan?.imageUrl || "";
  return "";
}

function hasCommercialPrice(value = "") {
  const normalized = String(value || "").toUpperCase();
  if (!normalized || /CONSULTE|CONFIRA|CONHEÇA/.test(normalized)) return false;
  return /(?:R\$|\d)/.test(normalized);
}

function draftNotices(input = {}, context = {}) {
  const draft = normalizeDraft(input, context);
  const notices = [];
  if (["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId)) {
    const movie = draft.entities.movie || {};
    if (!movie.backdropUrl && movie.posterUrl && draft.imageMode !== "upload") {
      notices.push({ type: "info", code: "POSTER_FALLBACK", message: "Este filme não possui backdrop. Estamos utilizando o pôster." });
    }
    if (!movie.backdropUrl && !movie.posterUrl && !draft.imageUrl) {
      notices.push({ type: "warning", code: "IMAGE_MISSING", message: "Este filme não possui imagem. A arte usará a identidade visual do cinema." });
    }
    if (draft.templateId === "movie-price" && !hasCommercialPrice(draft.price)) {
      notices.push({ type: "info", code: "PRICE_MISSING", message: "Não encontramos um preço para este filme. A composição convidará o cliente a conferir as sessões." });
    }
    if (movie.catalogued === false) {
      notices.push({ type: "info", code: "EDITORIAL_MOVIE", message: "Este lançamento ainda não está no catálogo. A arte usa previsão internacional e não anuncia sessão ou venda confirmada." });
    }
  }
  if (draft.templateId === "concession-combo" && !draft.entities.concession?.imageUrl && !draft.imageUrl) {
    notices.push({ type: "info", code: "PRODUCT_IMAGE_MISSING", message: "Este produto não possui imagem. A arte usará uma composição tipográfica da bomboniere." });
  }
  return notices;
}

function splitWords(value = "") {
  return String(value).trim().split(/\s+/).filter(Boolean);
}

function wrapLines(value, maxChars, maxLines = 3) {
  const words = splitWords(value);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remaining = words.slice(consumed);
  if (current && lines.length < maxLines) {
    const finalWords = remaining.length ? remaining : splitWords(current);
    let finalLine = finalWords.join(" ");
    if (finalLine.length > maxChars) finalLine = `${finalLine.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
    lines.push(finalLine);
  }
  return lines.slice(0, maxLines);
}

function fittedText(value, width, preferredSize, options = {}) {
  const minSize = options.minSize || Math.round(preferredSize * 0.58);
  const maxLines = options.maxLines || 3;
  const widthFactor = options.widthFactor || 0.62;
  let size = preferredSize;
  let lines = [];
  while (size >= minSize) {
    const maxChars = Math.max(8, Math.floor(width / (size * widthFactor)));
    lines = wrapLines(value, maxChars, maxLines);
    if (lines.join(" ").replace(/…$/, "").length >= String(value || "").length - 1 || size === minSize) break;
    size -= 2;
  }
  return { size, lines, lineHeight: Math.round(size * (options.lineHeight || 1.04)) };
}

function textBlock({ value, x, y, width, size, color = "#ffffff", weight = 800, maxLines = 3, anchor = "start", uppercase = false, lineHeight = 1.06, opacity = 1, fontFamily = "Arial, Helvetica, sans-serif", letterSpacing = 0, filter = "", widthFactor = 0.62 }) {
  const content = uppercase ? String(value || "").toUpperCase() : String(value || "");
  const fitted = fittedText(content, width, size, { maxLines, lineHeight, widthFactor });
  const tspans = fitted.lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fitted.lineHeight}">${xml(line)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" fill-opacity="${opacity}" font-family="${xml(fontFamily)}" font-size="${fitted.size}" font-weight="${weight}" letter-spacing="${letterSpacing}"${filter ? ` filter="${filter}"` : ""}>${tspans}</text>`;
}

function rect(x, y, width, height, fill, radius = 0, opacity = 1, stroke = "", strokeWidth = 0) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : ""}/>`;
}

function sharedChrome({ width, height, brand, margin }) {
  return rect(margin, height - margin - 32, width - margin * 2, 2, brand.textColor, 0, 0.22);
}

function onlineTicketMediaHeight(format) {
  if (format.id === "story") return 820;
  if (format.id === "square") return 380;
  return 540;
}

function posterFontDefinitions() {
  const definitions = [];
  if (SOCIAL_DISPLAY_FONT) definitions.push(`@font-face{font-family:'Social Poster Display';src:url(data:font/ttf;base64,${SOCIAL_DISPLAY_FONT}) format('truetype');font-weight:900;}`);
  if (SOCIAL_TEXT_FONT) definitions.push(`@font-face{font-family:'Social Poster Text';src:url(data:font/ttf;base64,${SOCIAL_TEXT_FONT}) format('truetype');font-weight:600;}`);
  return definitions.length ? `<style>${definitions.join("")}</style>` : "";
}

function posterWebsiteLabel(value = "") {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .slice(0, 80);
}

function compactPosterDate(value = "") {
  return String(value || "")
    .trim()
    .replace(/^previst[oa]\s+para\s+/i, "")
    .replace(/^a\s+partir\s+de\s+/i, "")
    .toUpperCase();
}

function cinematicPosterLayout(format) {
  if (format.id === "story") {
    return {
      fadeStart: 720,
      titleY: 1010,
      subtitleY: 1100,
      detailY: 1240,
      detailSize: 154,
      ruleY: 1310,
      cinemaY: 1375,
      auxiliaryY: 1435,
      ctaY: 1495,
      websiteY: 1555,
      logoBottom: 92
    };
  }
  if (format.id === "square") {
    return {
      fadeStart: 335,
      titleY: 455,
      subtitleY: 515,
      detailY: 620,
      detailSize: 112,
      ruleY: 676,
      cinemaY: 720,
      auxiliaryY: 760,
      ctaY: 800,
      websiteY: 840,
      logoBottom: 18
    };
  }
  return {
    fadeStart: 500,
    titleY: 640,
    subtitleY: 710,
    detailY: 835,
    detailSize: 132,
    ruleY: 895,
    cinemaY: 950,
    auxiliaryY: 998,
    ctaY: 1045,
    websiteY: 1090,
    logoBottom: 24
  };
}

function posterSafeLayoutForDraft(draft, format = formatById(draft?.formatId)) {
  const movieTemplate = ["movie-price", "movie-highlight", "movie-premiere"].includes(draft?.templateId);
  const movie = draft?.entities?.movie || {};
  const usesPoster = Boolean(movie.posterUrl) && (
    draft?.imageMode === "poster"
    || (draft?.imageMode === "automatic" && (format.id === "story" || !movie.backdropUrl))
    || (draft?.imageMode === "backdrop" && !movie.backdropUrl)
  );
  if (!movieTemplate || !usesPoster || draft?.style === "cinematic") return null;

  if (format.id === "story") {
    return {
      poster: { left: 220, top: 320, width: 640, height: 960 },
      panelTop: 1308,
      copy: { left: 82, top: 1360, width: 916 },
      titleY: 1450,
      detailY: 1595,
      auxiliaryY: 1655,
      cta: { left: 82, top: 1705, width: 450, height: 72 }
    };
  }
  if (format.id === "square") {
    return {
      poster: { left: 64, top: 270, width: 410, height: 615 },
      copy: { left: 530, top: 300, width: 486 },
      titleY: 380,
      detailY: 590,
      auxiliaryY: 665,
      cta: { left: 530, top: 830, width: 390, height: 70 }
    };
  }
  return {
    poster: { left: 64, top: 270, width: 480, height: 720 },
    copy: { left: 604, top: 330, width: 412 },
    titleY: 420,
    detailY: 700,
    auxiliaryY: 780,
    cta: { left: 604, top: 960, width: 380, height: 70 }
  };
}

function templateSvg(draft, context) {
  const format = formatById(draft.formatId);
  const { width, height } = format;
  const identity = normalizeBrand(context.identityBrand || context.brand);
  const palette = normalizeBrand(context.palette || context.brand);
  const brand = { ...palette, textColor: identity.textColor };
  const story = format.id === "story";
  const margin = story ? 82 : 64;
  const contentWidth = width - margin * 2;
  const movieTemplate = ["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId);
  const style = draft.style || "cinematic";
  const cinematicPoster = movieTemplate && style === "cinematic";
  const footer = cinematicPoster ? "" : sharedChrome({ width, height, brand: identity, margin });
  const subtitleSize = story ? 34 : 28;
  const titleSize = Math.round((story ? 92 : 78) * (draft.titleScale / 100));
  const bodySize = story ? 34 : 28;
  const priceSize = story ? 112 : 94;
  const overlay = clamp(draft.overlayIntensity / 100, 0.2, 1);
  const centered = draft.alignment === "center";
  const textX = centered ? width / 2 : margin;
  const anchor = centered ? "middle" : "start";
  const ctaWidth = Math.min(story ? 450 : 410, contentWidth * 0.62);
  const ctaX = centered ? (width - ctaWidth) / 2 : margin;
  const positionY = ({ top, center, bottom }) => draft.contentPosition === "top" ? top : draft.contentPosition === "center" ? center : bottom;
  const posterLayout = posterSafeLayoutForDraft(draft, format);
  let shapes = "";
  let copy = "";

  if (cinematicPoster) {
    const layout = cinematicPosterLayout(format);
    const hasPrice = draft.templateId === "movie-price" && hasCommercialPrice(draft.price);
    const detail = hasPrice ? draft.price : (compactPosterDate(draft.date) || "EM CARTAZ");
    const subtitle = String(draft.subtitle || (hasPrice ? "INGRESSOS" : "ESTREIA")).trim();
    const auxiliary = String(draft.auxiliaryText || "").trim().slice(0, 72);
    const website = posterWebsiteLabel(identity.posterWebsite || identity.website);
    const center = width / 2;
    const textWidth = width - (story ? 150 : 116);
    const neon = mixHex(identity.secondaryColor, "#76baff", 0.74);
    const glow = mixHex(neon, "#ffffff", 0.18);
    const titleColor = mixHex(brand.accentColor, "#ffffff", 0.12);
    const detailSize = Math.round(layout.detailSize * (draft.titleScale / 100));
    const fadeOffset = Math.round((layout.fadeStart / height) * 100);
    shapes = `<defs>
        <linearGradient id="cinematicFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="${Math.max(0, fadeOffset - 10)}%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="${fadeOffset}%" stop-color="#000000" stop-opacity="0.12"/>
          <stop offset="${Math.min(100, fadeOffset + 18)}%" stop-color="#000000" stop-opacity="0.82"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="1"/>
        </linearGradient>
        <radialGradient id="cinematicVignette" cx="50%" cy="38%" r="78%">
          <stop offset="44%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.76"/>
        </radialGradient>
        <filter id="posterNeon" x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur stdDeviation="7" result="blur"/>
          <feFlood flood-color="${glow}" flood-opacity="0.76" result="glowColor"/>
          <feComposite in="glowColor" in2="blur" operator="in" result="softGlow"/>
          <feMerge><feMergeNode in="softGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="posterSoftGlow" x="-20%" y="-30%" width="140%" height="170%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${rect(0, 0, width, height, "url(#cinematicVignette)")}
      ${rect(0, 0, width, height, "url(#cinematicFade)")}
      <line x1="${story ? 138 : 126}" y1="${layout.ruleY}" x2="${width - (story ? 138 : 126)}" y2="${layout.ruleY}" stroke="${neon}" stroke-width="3" stroke-opacity="0.92" filter="url(#posterSoftGlow)"/>
      <line x1="${story ? 138 : 126}" y1="${layout.ruleY + 8}" x2="${width - (story ? 138 : 126)}" y2="${layout.ruleY + 8}" stroke="${neon}" stroke-width="1" stroke-opacity="0.28"/>`;
    copy = `${textBlock({ value: draft.title, x: center, y: layout.titleY, width: textWidth, size: story ? 52 : 42, color: titleColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: story ? 8 : 7, widthFactor: 0.5 })}
      ${textBlock({ value: subtitle, x: center, y: layout.subtitleY, width: textWidth, size: story ? 48 : 38, color: neon, weight: 900, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: story ? 10 : 8, filter: "url(#posterSoftGlow)", widthFactor: 0.48 })}
      ${textBlock({ value: detail, x: center, y: layout.detailY, width: textWidth, size: detailSize, color: neon, weight: 900, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_DISPLAY_FAMILY, letterSpacing: 1, filter: "url(#posterNeon)", widthFactor: 0.62 })}
      ${textBlock({ value: `NO ${identity.name}`, x: center, y: layout.cinemaY, width: textWidth, size: story ? 45 : 35, color: neon, weight: 900, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: story ? 9 : 7, filter: "url(#posterSoftGlow)", widthFactor: 0.48 })}
      ${auxiliary ? textBlock({ value: auxiliary, x: center, y: layout.auxiliaryY, width: textWidth, size: story ? 27 : 22, color: "#d9e5f6", weight: 600, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: 4, opacity: 0.82, widthFactor: 0.48 }) : ""}
      ${textBlock({ value: draft.cta, x: center, y: layout.ctaY, width: textWidth, size: story ? 31 : 25, color: "#ffffff", weight: 600, maxLines: 1, anchor: "middle", uppercase: true, fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: story ? 7 : 6, widthFactor: 0.48 })}
      ${website ? textBlock({ value: website, x: center, y: layout.websiteY, width: textWidth, size: story ? 31 : 25, color: "#ffffff", weight: 600, maxLines: 1, anchor: "middle", fontFamily: SOCIAL_TEXT_FAMILY, letterSpacing: 1, widthFactor: 0.48 }) : ""}`;
  } else if (posterLayout) {
    const { poster, copy: copyArea, titleY, detailY, auxiliaryY, cta } = posterLayout;
    const hasPrice = draft.templateId === "movie-price" && hasCommercialPrice(draft.price);
    const detail = hasPrice ? draft.price : draft.date;
    const detailSize = hasPrice
      ? (story ? 62 : 54)
      : (story ? 36 : 30);
    const safeTitleSize = Math.round((story ? 70 : (format.id === "square" ? 48 : 54)) * (draft.titleScale / 100));
    const safeBodySize = story ? 28 : 22;
    const panelX = story ? 42 : copyArea.left - 28;
    const panelY = story ? posterLayout.panelTop : copyArea.top - 52;
    const panelWidth = story ? width - 84 : width - panelX - 36;
    const panelHeight = story ? 450 : (format.id === "square" ? 640 : 760);
    shapes = `<rect x="${poster.left - 12}" y="${poster.top - 12}" width="${poster.width + 24}" height="${poster.height + 24}" rx="10" fill="none" stroke="${identity.accentColor}" stroke-width="3"/>
      ${rect(panelX, panelY, panelWidth, panelHeight, mixHex(identity.primaryColor, identity.secondaryColor, 0.16), 8, 0.98)}
      ${rect(copyArea.left, copyArea.top - (story ? 28 : 35), Math.min(150, copyArea.width * 0.38), 7, identity.accentColor, 4)}
      ${rect(cta.left, cta.top, cta.width, cta.height, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: copyArea.left, y: copyArea.top, width: copyArea.width, size: story ? 30 : 23, color: identity.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: copyArea.left, y: titleY, width: copyArea.width, size: safeTitleSize, color: identity.textColor, weight: 900, maxLines: story ? 2 : 3 })}
      ${detail ? textBlock({ value: detail, x: copyArea.left, y: detailY, width: copyArea.width, size: detailSize, color: identity.accentColor, weight: 900, maxLines: 2 }) : ""}
      ${textBlock({ value: draft.auxiliaryText, x: copyArea.left, y: auxiliaryY, width: copyArea.width, size: safeBodySize, color: identity.textColor, weight: 700, maxLines: story ? 2 : 4, opacity: 0.9 })}
      ${textBlock({ value: `${draft.cta} →`, x: cta.left + cta.width / 2, y: cta.top + (story ? 47 : 46), width: cta.width - 34, size: story ? 24 : 21, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "movie-price") {
    const hasPrice = hasCommercialPrice(draft.price);
    const copyY = positionY({ top: story ? 430 : 300, center: story ? 780 : Math.round(height * 0.38), bottom: story ? 1010 : (format.id === "square" ? 430 : 610) });
    const noPriceCall = "CONFIRA AS SESSÕES E GARANTA SEU LUGAR";
    const ctaLimit = height - margin - (story ? 180 : 146);
    const ctaY = Math.min(hasPrice ? copyY + (story ? 650 : 465) : copyY + (story ? 540 : 395), ctaLimit);
    const auxiliaryY = ctaY - (story ? 68 : 52);
    shapes = `${movieOverlaySvg({ width, height, margin, copyY, brand, style, overlay })}
      ${rect(centered ? width / 2 - 90 : margin, copyY - 54, 180, 8, identity.accentColor, 4)}
      ${rect(ctaX, ctaY, ctaWidth, story ? 84 : 72, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: hasPrice ? draft.subtitle : "EM CARTAZ", x: textX, y: copyY, width: contentWidth * 0.82, size: subtitleSize, color: identity.accentColor, weight: 900, maxLines: 2, anchor, uppercase: true })}
      ${textBlock({ value: draft.title, x: textX, y: copyY + (story ? 110 : 92), width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3, anchor })}
      ${hasPrice
        ? textBlock({ value: draft.price, x: textX, y: copyY + (story ? 410 : 340), width: contentWidth, size: priceSize, color: identity.accentColor, weight: 900, maxLines: 2, anchor })
        : textBlock({ value: noPriceCall, x: textX, y: copyY + (story ? 410 : 340), width: contentWidth * 0.92, size: story ? 54 : 44, color: identity.accentColor, weight: 900, maxLines: 2, anchor })}
      ${hasPrice ? textBlock({ value: draft.auxiliaryText, x: textX, y: auxiliaryY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 2, anchor, opacity: 0.92 }) : ""}
      ${textBlock({ value: `${hasPrice ? draft.cta : "CONFIRA AS SESSÕES"} →`, x: ctaX + ctaWidth / 2, y: ctaY + (story ? 54 : 47), width: ctaWidth - 40, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "movie-highlight") {
    const copyY = positionY({ top: story ? 430 : 300, center: story ? 810 : Math.round(height * 0.39), bottom: story ? 1060 : (format.id === "square" ? 430 : 620) });
    const ctaY = Math.min(copyY + (story ? 535 : 440), height - margin - (story ? 180 : 146));
    const auxiliaryY = ctaY - (story ? 75 : 70);
    const dateY = auxiliaryY - (story ? 82 : 70);
    shapes = `${movieOverlaySvg({ width, height, margin, copyY, brand, style, overlay })}${rect(ctaX, ctaY, ctaWidth, story ? 84 : 72, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: textX, y: copyY, width: contentWidth, size: subtitleSize, color: identity.accentColor, weight: 900, maxLines: 2, anchor, uppercase: true })}
      ${textBlock({ value: draft.title, x: textX, y: copyY + 110, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3, anchor })}
      ${draft.date ? textBlock({ value: draft.date, x: textX, y: dateY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 1, anchor }) : ""}
      ${textBlock({ value: draft.auxiliaryText, x: textX, y: auxiliaryY, width: contentWidth, size: story ? 44 : 36, color: identity.accentColor, weight: 900, maxLines: 2, anchor })}
      ${textBlock({ value: `${draft.cta} →`, x: ctaX + ctaWidth / 2, y: ctaY + (story ? 54 : 47), width: ctaWidth - 40, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "movie-premiere") {
    const copyY = positionY({ top: story ? 470 : 320, center: story ? 820 : Math.round(height * 0.4), bottom: story ? 1060 : (format.id === "square" ? 455 : 640) });
    const badgeWidth = Math.min(540, contentWidth * 0.78);
    const badgeX = centered ? (width - badgeWidth) / 2 : margin;
    const ctaY = Math.min(copyY + (story ? 545 : 450), height - margin - (story ? 180 : 146));
    const auxiliaryY = ctaY - (story ? 70 : 58);
    const dateY = auxiliaryY - (story ? 86 : 76);
    shapes = `${movieOverlaySvg({ width, height, margin, copyY, brand, style, overlay })}
      ${rect(badgeX, copyY - 72, badgeWidth, story ? 76 : 64, identity.accentColor, 6)}
      ${rect(ctaX, ctaY, ctaWidth, story ? 84 : 72, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: badgeX + badgeWidth / 2, y: copyY - (story ? 21 : 28), width: badgeWidth - 38, size: subtitleSize, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}
      ${textBlock({ value: draft.title, x: textX, y: copyY + 105, width: contentWidth, size: titleSize + 4, color: brand.textColor, weight: 900, maxLines: 3, anchor })}
      ${draft.date ? textBlock({ value: draft.date, x: textX, y: dateY, width: contentWidth, size: story ? 48 : 40, color: identity.accentColor, weight: 900, maxLines: 1, anchor }) : ""}
      ${textBlock({ value: draft.auxiliaryText, x: textX, y: auxiliaryY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 2, anchor })}
      ${textBlock({ value: `${draft.cta} →`, x: ctaX + ctaWidth / 2, y: ctaY + (story ? 54 : 47), width: ctaWidth - 40, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "online-ticket") {
    const mediaHeight = onlineTicketMediaHeight(format);
    const compactSquare = format.id === "square";
    const onlineTitleSize = compactSquare ? Math.round(66 * (draft.titleScale / 100)) : titleSize;
    const auxiliaryY = story ? mediaHeight + 530 : (compactSquare ? 800 : mediaHeight + 500);
    shapes = `${rect(0, 0, width, height, brand.primaryColor)}${rect(0, 0, width, mediaHeight, brand.secondaryColor, 0, 0.22)}
      ${rect(margin, mediaHeight + 65, 130, 8, brand.accentColor, 4)}
      ${rect(margin, height - margin - 150, Math.min(390, contentWidth * 0.56), story ? 82 : 70, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: mediaHeight + (compactSquare ? 108 : 130), width: contentWidth, size: subtitleSize, color: identity.accentColor, weight: 900, maxLines: 1, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: mediaHeight + (compactSquare ? 190 : 235), width: contentWidth, size: onlineTitleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: auxiliaryY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: compactSquare ? 2 : 3, opacity: 0.88 })}
      ${textBlock({ value: `${draft.cta} →`, x: margin + Math.min(390, contentWidth * 0.56) / 2, y: height - margin - (story ? 98 : 106), width: 340, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "concession-combo") {
    const copyY = story ? 930 : (format.id === "square" ? 410 : 620);
    const auxiliaryY = copyY + (story ? 360 : 260);
    const priceY = copyY + (story ? 500 : 365);
    const ctaY = Math.min(copyY + (story ? 590 : 455), height - margin - (story ? 180 : 125));
    shapes = `
      <defs><linearGradient id="productShade" x1="0" y1="0" x2="0" y2="1"><stop offset="30%" stop-color="${brand.primaryColor}" stop-opacity="0"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, copyY + 100, "url(#productShade)")}
      ${rect(margin, copyY - 45, 170, 8, brand.accentColor, 4)}
      ${rect(margin, ctaY, Math.min(420, contentWidth * 0.58), story ? 82 : 70, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY + 10, width: contentWidth, size: subtitleSize, color: identity.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 125, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: auxiliaryY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 600, maxLines: 3, opacity: 0.86 })}
      ${textBlock({ value: draft.price, x: margin, y: priceY, width: contentWidth, size: priceSize, color: identity.accentColor, weight: 900, maxLines: 1 })}
      ${textBlock({ value: `${draft.cta} →`, x: margin + Math.min(420, contentWidth * 0.58) / 2, y: ctaY + (story ? 53 : 46), width: 370, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else {
    const copyY = story ? 930 : (format.id === "square" ? 400 : 620);
    const priceY = copyY + (story ? 380 : 270);
    const auxiliaryY = copyY + (story ? 500 : 360);
    const ctaY = Math.min(copyY + (story ? 570 : 450), height - margin - (story ? 180 : 125));
    shapes = `${rect(0, 0, width, height, brand.primaryColor)}
      <defs><linearGradient id="clubShade" x1="0" y1="0" x2="0" y2="1"><stop offset="20%" stop-color="${brand.secondaryColor}" stop-opacity="0.12"/><stop offset="70%" stop-color="${brand.primaryColor}" stop-opacity="0.9"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#clubShade)")}
      ${rect(margin, copyY - 52, 180, 8, brand.accentColor, 4)}
      ${rect(margin, ctaY, Math.min(420, contentWidth * 0.58), story ? 82 : 70, identity.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY, width: contentWidth, size: subtitleSize, color: identity.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 120, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.price, x: margin, y: priceY, width: contentWidth, size: story ? 76 : 64, color: identity.accentColor, weight: 900, maxLines: 2 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: auxiliaryY, width: contentWidth, size: bodySize, color: brand.textColor, weight: 600, maxLines: 3, opacity: 0.88 })}
      ${textBlock({ value: `${draft.cta} →`, x: margin + Math.min(420, contentWidth * 0.58) / 2, y: ctaY + (story ? 53 : 46), width: 370, size: story ? 27 : 23, color: identity.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  }

  const darken = !posterLayout && draft.darken > 0 ? rect(0, 0, width, height, "#000000", 0, draft.darken / 100) : "";
  const storyGuidance = movieTemplate && story ? `<rect x="${margin}" y="160" width="${contentWidth}" height="${height - 350}" fill="none" stroke="#ffffff" stroke-opacity="0"/>` : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${posterFontDefinitions()}${darken}${shapes}${copy}${footer}${storyGuidance}</svg>`);
}

function movieOverlaySvg({ width, height, margin, copyY, brand, style, overlay }) {
  const safeOverlay = clamp(overlay, 0.2, 1);
  if (style === "impact") {
    const panelWidth = Math.round(width * 0.62);
    return `<defs><linearGradient id="movieImpact" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay}"/><stop offset="78%" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay * 0.9}"/><stop offset="100%" stop-color="${brand.primaryColor}" stop-opacity="0"/></linearGradient></defs>${rect(0, 0, panelWidth, height, "url(#movieImpact)")}`;
  }
  if (style === "clean") {
    const top = Math.max(0, copyY - 110);
    return `${rect(0, top, width, height - top, brand.primaryColor, 0, Math.max(0.78, safeOverlay * 0.9))}${rect(margin, top, width - margin * 2, 2, brand.accentColor, 0, 0.7)}`;
  }
  if (style === "minimal") {
    return `<defs><linearGradient id="movieMinimal" x1="0" y1="0" x2="0" y2="1"><stop offset="42%" stop-color="${brand.primaryColor}" stop-opacity="0"/><stop offset="74%" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay * 0.72}"/><stop offset="100%" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#movieMinimal)")}`;
  }
  return `<defs><linearGradient id="movieCinema" x1="0" y1="0" x2="0" y2="1"><stop offset="18%" stop-color="${brand.primaryColor}" stop-opacity="0.02"/><stop offset="64%" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay * 0.84}"/><stop offset="100%" stop-color="${brand.primaryColor}" stop-opacity="${safeOverlay}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#movieCinema)")}`;
}

async function resizeImage(buffer, width, height, fit = "cover", background = { r: 7, g: 17, b: 31, alpha: 1 }) {
  if (!buffer) return null;
  return sharp(buffer, { failOn: "error" }).rotate().resize(width, height, { fit, position: "centre", background }).png().toBuffer();
}

async function resizeSignature(buffer, maxWidth, maxHeight) {
  if (!buffer) return null;
  return sharp(buffer, { failOn: "error" })
    .rotate()
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toBuffer();
}

function signatureBounds(signature, draft, format) {
  const story = draft.formatId === "story";
  const scale = draft.signatureScale / 100;
  const cinematicMovie = draft.style === "cinematic" && ["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId);
  const dimensions = cinematicMovie && signature.id === "logo-3d" ? [story ? 430 : 360, story ? 260 : 220] : ({
    classic: [story ? 230 : 190, story ? 116 : 96],
    "icon-3d": [story ? 150 : 122, story ? 150 : 122],
    "wordmark-3d": [story ? 390 : 320, story ? 142 : 118],
    "logo-3d": [story ? 360 : 290, story ? 220 : 178]
  }[signature.id] || [story ? 230 : 190, story ? 116 : 96]);
  return {
    maxWidth: Math.min(format.width, Math.round(dimensions[0] * scale)),
    maxHeight: Math.min(format.height, Math.round(dimensions[1] * scale))
  };
}

function signatureCoordinates(signature, draft, format, renderedWidth, renderedHeight) {
  const story = draft.formatId === "story";
  const margin = story ? 82 : 64;
  const cinematicMovie = draft.style === "cinematic" && ["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId);
  const automaticPosition = cinematicMovie ? "bottom-center" : "top-left";
  const position = draft.signaturePosition === "automatic" ? automaticPosition : draft.signaturePosition;
  const top = story ? 72 : 54;
  if (position === "top-center") return { top, left: Math.round((format.width - renderedWidth) / 2) };
  if (position === "top-right") return { top, left: format.width - margin - renderedWidth };
  if (position === "bottom-center") return {
    top: format.height - renderedHeight - (cinematicMovie ? cinematicPosterLayout(format).logoBottom : (story ? 96 : 42)),
    left: Math.round((format.width - renderedWidth) / 2)
  };
  if (position === "bottom-right") return {
    top: format.height - margin - renderedHeight - (story ? 96 : 78),
    left: format.width - margin - renderedWidth
  };
  return { top, left: margin };
}

function imageAnchor(draft) {
  const presets = {
    center: [50, 50],
    left: [22, 50],
    right: [78, 50],
    top: [50, 20],
    bottom: [50, 80]
  };
  if (draft.imagePreset && draft.imagePreset !== "automatic" && presets[draft.imagePreset]) return presets[draft.imagePreset];
  return [draft.imagePositionX, draft.imagePositionY];
}

async function resizePositionedImage(buffer, width, height, draft, background) {
  if (!buffer) return null;
  const scale = clamp(draft.imageScale, 100, 180) / 100;
  const scaledWidth = Math.max(width, Math.round(width * scale));
  const scaledHeight = Math.max(height, Math.round(height * scale));
  const [anchorX, anchorY] = imageAnchor(draft);
  const left = Math.round((scaledWidth - width) * clamp(anchorX / 100, 0, 1));
  const top = Math.round((scaledHeight - height) * clamp(anchorY / 100, 0, 1));
  let pipeline = sharp(buffer, { failOn: "error" })
    .rotate()
    .resize(scaledWidth, scaledHeight, { fit: "cover", position: "centre", background })
    .extract({ left, top, width, height });
  if (draft.blur > 0) pipeline = pipeline.blur(Math.max(0.3, draft.blur));
  return pipeline.png().toBuffer();
}

async function paletteFromImage(buffer, brand) {
  if (!buffer) return normalizeBrand(brand);
  const stats = await sharp(buffer, { failOn: "error" }).resize(96, 96, { fit: "cover" }).stats().catch(() => null);
  if (!stats?.dominant) return normalizeBrand(brand);
  const dominant = rgbToHex(stats.dominant);
  const configured = normalizeBrand(brand);
  return {
    ...configured,
    primaryColor: mixHex(dominant, "#030711", 0.72),
    secondaryColor: mixHex(dominant, configured.secondaryColor, 0.42),
    accentColor: mixHex(dominant, configured.accentColor, 0.58)
  };
}

async function renderSocialPost(input = {}, context = {}, options = {}) {
  const draft = normalizeDraft(input, context);
  const format = formatById(draft.formatId);
  const brand = normalizeBrand(context.brand);
  const canvas = sharp({
    create: { width: format.width, height: format.height, channels: 4, background: brand.primaryColor }
  });
  const composites = [];
  const loadImage = typeof options.loadImage === "function" ? options.loadImage : async () => null;
  const sourceUrl = sourceImageForDraft(draft);
  const sourceBuffer = sourceUrl ? await loadImage(sourceUrl) : null;
  const posterLayout = posterSafeLayoutForDraft(draft, format);
  const backgroundFit = draft.templateId === "online-ticket" ? "contain" : "cover";
  if (sourceBuffer) {
    if (posterLayout) {
      const renderedPoster = await resizeImage(
        sourceBuffer,
        posterLayout.poster.width,
        posterLayout.poster.height,
        "contain",
        brand.primaryColor
      ).catch(() => null);
      if (renderedPoster) composites.push({ input: renderedPoster, top: posterLayout.poster.top, left: posterLayout.poster.left });
    } else {
      const targetHeight = draft.templateId === "online-ticket"
        ? onlineTicketMediaHeight(format)
        : format.height;
      const renderedSource = backgroundFit === "cover"
        ? await resizePositionedImage(sourceBuffer, format.width, targetHeight, draft, brand.primaryColor).catch(() => null)
        : await resizeImage(sourceBuffer, format.width, targetHeight, backgroundFit, brand.primaryColor).catch(() => null);
      if (renderedSource) composites.push({ input: renderedSource, top: 0, left: 0 });
    }
  } else if (draft.templateId === "online-ticket") {
    const h = onlineTicketMediaHeight(format);
    composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${format.width}" height="${h}"><rect width="100%" height="100%" fill="${brand.secondaryColor}" fill-opacity=".22"/><rect x="90" y="100" width="900" height="${h - 180}" rx="20" fill="#ffffff" fill-opacity=".08"/><rect x="145" y="160" width="790" height="74" rx="8" fill="#ffffff" fill-opacity=".12"/><rect x="145" y="280" width="350" height="${Math.max(150, h - 390)}" rx="12" fill="${brand.accentColor}" fill-opacity=".92"/><rect x="535" y="280" width="400" height="62" rx="8" fill="#ffffff" fill-opacity=".16"/><rect x="535" y="372" width="310" height="62" rx="8" fill="#ffffff" fill-opacity=".1"/><rect x="535" y="464" width="260" height="62" rx="8" fill="${brand.accentColor}"/></svg>`), top: 0, left: 0 });
  }

  const supportsDynamicPalette = ["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId);
  const useDynamicPalette = supportsDynamicPalette && draft.paletteMode !== "brand" && Boolean(sourceBuffer);
  const palette = useDynamicPalette ? await paletteFromImage(sourceBuffer, brand) : brand;
  const svg = templateSvg(draft, { ...context, brand: palette, palette, identityBrand: brand });
  composites.push({ input: svg, top: 0, left: 0 });

  const signature = signatureForDraft(draft, context);
  const signatureBuffer = signature?.imageUrl ? await loadImage(signature.imageUrl) : null;
  if (signatureBuffer) {
    const bounds = signatureBounds(signature, draft, format);
    const resizedSignature = await resizeSignature(signatureBuffer, bounds.maxWidth, bounds.maxHeight).catch(() => null);
    if (resizedSignature) {
      const metadata = await sharp(resizedSignature).metadata();
      const coordinates = signatureCoordinates(signature, draft, format, metadata.width || bounds.maxWidth, metadata.height || bounds.maxHeight);
      composites.push({ input: resizedSignature, top: coordinates.top, left: coordinates.left });
    }
  }

  let pipeline = canvas.composite(composites);
  const outputType = draft.outputType;
  const buffer = outputType === "jpg"
    ? await pipeline.flatten({ background: brand.primaryColor }).jpeg({ quality: 94, chromaSubsampling: "4:4:4", progressive: true }).toBuffer()
    : await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
  return {
    buffer,
    draft,
      format,
      palette,
      notices: draftNotices(draft, context),
      contentType: outputType === "jpg" ? "image/jpeg" : "image/png",
    extension: outputType === "jpg" ? ".jpg" : ".png"
  };
}

function captionForDraft(input = {}, context = {}) {
  const draft = normalizeDraft(input, context);
  if (draft.caption) return draft.caption;
  const brand = normalizeBrand(context.brand);
  const link = brand.website ? `\n\nConfira em ${brand.website}` : "";
  if (["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId)) {
    const price = draft.price ? `\nIngressos: ${draft.price}` : "";
    const sessions = draft.auxiliaryText ? `\nSessões: ${draft.auxiliaryText}` : "";
    return `🎬 ${draft.title} no ${brand.name}!\n\n${draft.subtitle}.${sessions}${price}\n\nGaranta seu ingresso e escolha seu lugar antecipadamente.${link}`;
  }
  if (draft.templateId === "concession-combo") {
    return `🍿 ${draft.title}\n\n${draft.auxiliaryText}.${draft.price ? `\n${draft.price}` : ""}\n\nAdicione à sua compra e aproveite a sessão completa.${link}`;
  }
  if (draft.templateId === "cinema-club") {
    return `🎟 ${draft.title}\n\n${draft.auxiliaryText}.${draft.price ? `\n${draft.price}` : ""}\n\nCinema todo mês, com benefícios para aproveitar ainda mais.${link}`;
  }
  return `Compre seu ingresso online no ${brand.name}.\n\nEscolha o filme, selecione seu lugar e finalize com rapidez.${link}`;
}

function hashtagForTitle(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
    .slice(0, 46);
}

function catalogCaption(movie = {}, context = {}, index = 0) {
  const brand = normalizeBrand(context.brand);
  const intros = [
    `🎬 ${movie.title} merece tela grande, som de cinema e atenção até o último crédito.`,
    `🍿 A próxima história da sua lista pode ser ${movie.title}.`,
    `✨ Tem filme que fica ainda melhor quando a sala escurece: ${movie.title}.`,
    `🎞️ Prepare-se para entrar no universo de ${movie.title}.`
  ];
  const details = [];
  if (movie.genres?.length) details.push(movie.genres.slice(0, 3).join(", "));
  if (movie.rating) details.push(`classificação ${movie.rating}`);
  const times = movieSessionTimes(movie);
  const release = movie.releaseDate ? formatDate(movie.releaseDate) : "";
  const programming = times.length
    ? `Sessões disponíveis: ${times.join(" • ")}. Escolha seu lugar e antecipe a compra pelo site.`
    : release
      ? `Data cadastrada: ${release}. Consulte a programação atualizada antes de planejar sua sessão.`
      : "Consulte a programação atualizada e acompanhe a abertura das próximas sessões.";
  const synopsis = String(movie.synopsis || "").trim();
  const synopsisLine = synopsis ? `\n\n${synopsis.slice(0, 280)}${synopsis.length > 280 ? "…" : ""}` : "";
  const website = brand.website ? `\n\n${brand.website}` : "";
  return `${intros[index % intros.length]}${details.length ? `\n\n${details.join(" • ")}.` : ""}${synopsisLine}\n\n${programming}${website}\n\n#${hashtagForTitle(movie.title)} #CineCruzeiro #Cinema`;
}

function buildSocialReadyPosts(context = {}) {
  const movies = Array.isArray(context.movies) ? context.movies : [];
  const catalogMovies = movies.filter((movie) => movie.catalogued !== false);
  const editorialMovies = movies.filter((movie) => movie.catalogued === false);
  const toPost = (movie, collection, index) => {
    const editorial = collection === "editorial";
    const times = movieSessionTimes(movie);
    const rawDraft = {
      templateId: editorial ? "movie-premiere" : (movie.status === "upcoming" ? "movie-premiere" : "movie-highlight"),
      formatId: "feed_portrait",
      outputType: "png",
      style: "cinematic",
      movieId: movie.id,
      title: movie.title,
      subtitle: editorial ? "PRÓXIMO LANÇAMENTO" : (movie.status === "upcoming" ? "EM BREVE NO CINE CRUZEIRO" : "NO CINE CRUZEIRO"),
      date: editorial ? movie.releaseLabel : formatDate(movie.sessions?.[0]?.date || movie.releaseDate),
      auxiliaryText: editorial ? movie.socialHook : (times.length ? times.join("  •  ") : "Confira a programação atualizada"),
      cta: editorial ? "ACOMPANHE AS NOVIDADES" : (times.length ? "COMPRE AGORA" : "CONFIRA A PROGRAMAÇÃO"),
      imageMode: "poster",
      imagePreset: "top",
      overlayIntensity: editorial ? 78 : 72,
      darken: editorial ? 10 : 8,
      contentPosition: "bottom",
      signatureId: "automatic",
      signaturePosition: "automatic",
      signatureScale: 100,
      caption: editorial ? movie.editorialCaption : catalogCaption(movie, context, index)
    };
    const normalized = normalizeDraft(rawDraft, context);
    const { entities, ...draft } = normalized;
    return {
      id: `${collection}-${movie.id}`,
      collection,
      badge: editorial ? "Ainda não cadastrado" : (times.length ? "Com sessões" : "Filme cadastrado"),
      title: movie.title,
      description: editorial
        ? movie.releaseLabel
        : (times.length ? `Sessões: ${times.join(" • ")}` : (movie.releaseDate ? `Data cadastrada: ${formatDate(movie.releaseDate)}` : "Programação a confirmar")),
      imageUrl: movie.posterUrl || movie.backdropUrl || "",
      sourceName: editorial ? String(movie.sourceName || "") : "Dados do painel",
      sourceUrl: editorial ? String(movie.sourceUrl || "") : "",
      draft,
      caption: normalized.caption,
      notices: draftNotices(normalized, context)
    };
  };
  return [
    ...catalogMovies.map((movie, index) => toPost(movie, "catalog", index)),
    ...editorialMovies.map((movie, index) => toPost(movie, "editorial", index))
  ];
}

function createHistoryRecord(rendered, input = {}, context = {}, actor = "") {
  const now = new Date().toISOString();
  const actorUserId = typeof actor === "object" ? actor?.id : actor;
  const actorName = typeof actor === "object" ? (actor?.name || actor?.email || actor?.id) : actor;
  const entityName = rendered.draft.entities.movie?.title
    || rendered.draft.entities.concession?.name
    || rendered.draft.entities.clubPlan?.name
    || rendered.draft.title;
  return {
    id: `social-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    templateId: rendered.draft.templateId,
    templateName: rendered.template?.name || templateById(rendered.draft.templateId).name,
    formatId: rendered.draft.formatId,
    formatName: rendered.format.name,
    width: rendered.format.width,
    height: rendered.format.height,
    outputType: rendered.draft.outputType,
    title: rendered.draft.title,
    contentName: String(entityName || rendered.draft.title || ""),
    status: "ready",
    rendererVersion: rendered.rendererVersion || "legacy",
    imageUrl: String(input.savedImageUrl || ""),
    originalImageUrl: String(input.savedImageUrl || ""),
    originalScene: rendered.scene || null,
    draftScene: null,
    editedScene: null,
    activeVersion: "automatic",
    sceneVersions: rendered.scene ? [{
      id: "automatic",
      kind: "automatic",
      imageUrl: String(input.savedImageUrl || ""),
      outputType: rendered.draft.outputType,
      createdAt: now,
      createdBy: String(actorUserId || "")
    }] : [],
    caption: captionForDraft(rendered.draft, context),
    payload: {
      rendererVersion: rendered.rendererVersion || "legacy",
      templateId: rendered.draft.templateId,
      formatId: rendered.draft.formatId,
      outputType: rendered.draft.outputType,
      style: rendered.draft.style,
      visualStyle: rendered.draft.visualStyle,
      copyTone: rendered.draft.copyTone,
      copyDensity: rendered.draft.copyDensity,
      copyLocks: rendered.draft.copyLocks,
      layoutId: rendered.draft.layoutId,
      programLayout: rendered.draft.programLayout,
      featuredMovieId: rendered.draft.featuredMovieId,
      look: rendered.draft.look,
      content: rendered.draft.content,
      primaryDateKind: rendered.draft.primaryDateKind,
      releaseDate: rendered.draft.releaseDate,
      presaleStartDate: rendered.draft.presaleStartDate,
      sessionDate: rendered.draft.sessionDate,
      actionDestination: rendered.draft.actionDestination,
      actionDestinationType: rendered.draft.actionDestinationType,
      movieId: rendered.draft.movieId,
      concessionId: rendered.draft.concessionId,
      clubPlanId: rendered.draft.clubPlanId,
      title: rendered.draft.title,
      subtitle: rendered.draft.subtitle,
      cta: rendered.draft.cta,
      price: rendered.draft.price,
      date: rendered.draft.date,
      auxiliaryText: rendered.draft.auxiliaryText,
      imageUrl: rendered.draft.imageUrl,
      imageMode: rendered.draft.imageMode,
      imagePreset: rendered.draft.imagePreset,
      imagePositionX: rendered.draft.imagePositionX,
      imagePositionY: rendered.draft.imagePositionY,
      imageScale: rendered.draft.imageScale,
      overlayIntensity: rendered.draft.overlayIntensity,
      darken: rendered.draft.darken,
      blur: rendered.draft.blur,
      contentPosition: rendered.draft.contentPosition,
      alignment: rendered.draft.alignment,
      titleScale: rendered.draft.titleScale,
      paletteMode: rendered.draft.paletteMode,
      paletteId: rendered.draft.paletteId || "automatic",
      composition: rendered.draft.composition,
      artDirection: rendered.draft.artDirection,
      automaticStyle: rendered.draft.automaticStyle,
      polish: rendered.draft.polish === true,
      movieIds: rendered.draft.movieIds,
      multiLayout: rendered.draft.multiLayout,
      scheduleMode: rendered.draft.scheduleMode,
      periodStart: rendered.draft.periodStart,
      showSessions: rendered.draft.showSessions,
      animation: rendered.draft.animation,
      motion: rendered.draft.motion,
      signatureId: rendered.draft.signatureId,
      signaturePosition: rendered.draft.signaturePosition,
      signatureScale: rendered.draft.signatureScale,
      caption: rendered.draft.caption
    },
    createdBy: String(actorUserId || ""),
    createdByName: String(actorName || actorUserId || ""),
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  FALLBACK_BRAND,
  SOCIAL_FORMATS,
  SOCIAL_SIGNATURES,
  SOCIAL_STYLES,
  SOCIAL_TEMPLATES,
  buildSocialReadyPosts,
  captionForDraft,
  createHistoryRecord,
  defaultCopy,
  draftNotices,
  formatById,
  formatMoney,
  hasCommercialPrice,
  minimumMoviePrice,
  normalizeBrand,
  normalizeDraft,
  compactPosterDate,
  renderSocialPost,
  posterSafeLayoutForDraft,
  signatureForDraft,
  sourceImageForDraft,
  templateById,
  wrapLines
};
