const crypto = require("crypto");
const sharp = require("sharp");

const SOCIAL_FORMATS = Object.freeze({
  feed_portrait: { id: "feed_portrait", name: "Instagram Feed 4:5", width: 1080, height: 1350 },
  square: { id: "square", name: "Instagram/Facebook quadrado", width: 1080, height: 1080 },
  story: { id: "story", name: "Instagram Stories", width: 1080, height: 1920 }
});

const SOCIAL_TEMPLATES = Object.freeze([
  { id: "movie-price", name: "Ingresso a partir de", type: "movie", requiredData: ["movie"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "movie-highlight", name: "Filme em destaque", type: "movie", requiredData: ["movie"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "movie-premiere", name: "Estreia da semana", type: "movie", requiredData: ["movie"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "online-ticket", name: "Compre online", type: "institutional", requiredData: [], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "concession-combo", name: "Oferta da bomboniere", type: "concession", requiredData: ["concession"], formats: Object.keys(SOCIAL_FORMATS) },
  { id: "cinema-club", name: "Plano do clube", type: "club", requiredData: ["clubPlan"], formats: Object.keys(SOCIAL_FORMATS) }
]);

const FALLBACK_BRAND = Object.freeze({
  name: "Cinema",
  logoUrl: "",
  website: "",
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
      subtitle: "ESTREIA ESTA SEMANA",
      cta: "VER SESSÕES",
      price: price === null ? "" : `Ingressos a partir de ${formatMoney(price)}`,
      date: formatDate(movie.releaseDate || firstSession.date),
      auxiliaryText: times.length ? times.join("  •  ") : "Programação no site"
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
  return {
    templateId: template.id,
    formatId: format.id,
    outputType: input.outputType === "jpg" ? "jpg" : "png",
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
    caption: clean(input.caption, "", 1800),
    entities
  };
}

function sourceImageForDraft(draft) {
  if (draft.imageUrl) return draft.imageUrl;
  if (["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId)) {
    return draft.entities.movie?.backdropUrl || draft.entities.movie?.posterUrl || "";
  }
  if (draft.templateId === "concession-combo") return draft.entities.concession?.imageUrl || "";
  if (draft.templateId === "cinema-club") return draft.entities.clubPlan?.imageUrl || "";
  return "";
}

function posterImageForDraft(draft) {
  if (!["movie-price", "movie-highlight", "movie-premiere"].includes(draft.templateId)) return "";
  return draft.entities.movie?.posterUrl || "";
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
  let size = preferredSize;
  let lines = [];
  while (size >= minSize) {
    const maxChars = Math.max(8, Math.floor(width / (size * 0.62)));
    lines = wrapLines(value, maxChars, maxLines);
    if (lines.join(" ").replace(/…$/, "").length >= String(value || "").length - 1 || size === minSize) break;
    size -= 2;
  }
  return { size, lines, lineHeight: Math.round(size * (options.lineHeight || 1.04)) };
}

function textBlock({ value, x, y, width, size, color = "#ffffff", weight = 800, maxLines = 3, anchor = "start", uppercase = false, lineHeight = 1.06, opacity = 1 }) {
  const content = uppercase ? String(value || "").toUpperCase() : String(value || "");
  const fitted = fittedText(content, width, size, { maxLines, lineHeight });
  const tspans = fitted.lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fitted.lineHeight}">${xml(line)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" fill-opacity="${opacity}" font-family="Arial, Helvetica, sans-serif" font-size="${fitted.size}" font-weight="${weight}">${tspans}</text>`;
}

function rect(x, y, width, height, fill, radius = 0, opacity = 1, stroke = "", strokeWidth = 0) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : ""}/>`;
}

function safeWebsiteLabel(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "").replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 80);
  }
}

function sharedChrome({ width, height, brand, margin }) {
  const website = safeWebsiteLabel(brand.website);
  return [
    rect(margin, height - margin - 54, width - margin * 2, 2, brand.textColor, 0, 0.22),
    website ? textBlock({ value: website, x: margin, y: height - margin - 12, width: width * 0.65, size: 24, color: brand.textColor, weight: 700, maxLines: 1, opacity: 0.92 }) : ""
  ].join("");
}

function templateSvg(draft, context) {
  const format = formatById(draft.formatId);
  const { width, height } = format;
  const brand = normalizeBrand(context.brand);
  const story = format.id === "story";
  const margin = story ? 82 : 64;
  const contentWidth = width - margin * 2;
  const footer = sharedChrome({ width, height, brand, margin });
  const subtitleSize = story ? 34 : 28;
  const titleSize = story ? 92 : 78;
  const bodySize = story ? 34 : 28;
  const priceSize = story ? 112 : 94;
  let shapes = "";
  let copy = "";

  if (draft.templateId === "movie-price") {
    const copyY = story ? 1110 : Math.round(height * 0.56);
    shapes = `${rect(0, 0, width, height, brand.primaryColor, 0, 0.24)}
      <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="20%" stop-color="${brand.primaryColor}" stop-opacity="0.04"/><stop offset="68%" stop-color="${brand.primaryColor}" stop-opacity="0.88"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>
      ${rect(0, 0, width, height, "url(#shade)")}
      ${rect(margin, copyY - 54, 180, 8, brand.accentColor, 4)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY, width: contentWidth * 0.75, size: subtitleSize, color: brand.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + (story ? 105 : 88), width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.price, x: margin, y: copyY + (story ? 405 : 330), width: contentWidth, size: priceSize, color: brand.accentColor, weight: 900, maxLines: 2 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: copyY + (story ? 565 : 462), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 2, opacity: 0.9 })}
      ${rect(margin, copyY + (story ? 655 : 535), Math.min(390, contentWidth * 0.55), story ? 82 : 70, brand.accentColor, 8)}
      ${textBlock({ value: draft.cta, x: margin + Math.min(390, contentWidth * 0.55) / 2, y: copyY + (story ? 708 : 581), width: Math.min(350, contentWidth * 0.5), size: story ? 27 : 23, color: brand.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "movie-highlight") {
    const copyY = story ? 1160 : Math.round(height * 0.61);
    shapes = `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="16%" stop-color="${brand.primaryColor}" stop-opacity="0.02"/><stop offset="62%" stop-color="${brand.primaryColor}" stop-opacity="0.84"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#shade)")}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY, width: contentWidth, size: subtitleSize, color: brand.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 104, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${draft.date ? textBlock({ value: draft.date, x: margin, y: copyY + (story ? 390 : 320), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 1 }) : ""}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: copyY + (story ? 470 : 395), width: contentWidth, size: story ? 44 : 36, color: brand.accentColor, weight: 900, maxLines: 2 })}
      ${draft.price ? textBlock({ value: draft.price, x: margin, y: copyY + (story ? 590 : 490), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 1 }) : ""}`;
  } else if (draft.templateId === "movie-premiere") {
    const copyY = story ? 1125 : Math.round(height * 0.58);
    shapes = `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="12%" stop-color="${brand.primaryColor}" stop-opacity="0.08"/><stop offset="58%" stop-color="${brand.primaryColor}" stop-opacity="0.82"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#shade)")}
      ${rect(margin, copyY - 67, Math.min(520, contentWidth), story ? 74 : 62, brand.accentColor, 6)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin + Math.min(520, contentWidth) / 2, y: copyY - (story ? 18 : 25), width: Math.min(470, contentWidth - 30), size: subtitleSize, color: brand.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 98, width: contentWidth, size: titleSize + 4, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${draft.date ? textBlock({ value: draft.date, x: margin, y: copyY + (story ? 400 : 330), width: contentWidth, size: story ? 48 : 40, color: brand.accentColor, weight: 900, maxLines: 1 }) : ""}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: copyY + (story ? 485 : 410), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 2 })}
      ${draft.price ? textBlock({ value: draft.price, x: margin, y: copyY + (story ? 590 : 500), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 2, opacity: 0.9 }) : ""}`;
  } else if (draft.templateId === "online-ticket") {
    const mediaHeight = story ? 820 : Math.round(height * 0.48);
    shapes = `${rect(0, 0, width, height, brand.primaryColor)}${rect(0, 0, width, mediaHeight, brand.secondaryColor, 0, 0.22)}
      ${rect(margin, mediaHeight + 65, 130, 8, brand.accentColor, 4)}
      ${rect(margin, height - margin - 150, Math.min(360, contentWidth * 0.52), story ? 82 : 70, brand.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: mediaHeight + 130, width: contentWidth, size: subtitleSize, color: brand.accentColor, weight: 900, maxLines: 1, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: mediaHeight + 235, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: mediaHeight + (story ? 530 : 480), width: contentWidth, size: bodySize, color: brand.textColor, weight: 700, maxLines: 3, opacity: 0.88 })}
      ${textBlock({ value: draft.cta, x: margin + Math.min(360, contentWidth * 0.52) / 2, y: height - margin - (story ? 98 : 106), width: 320, size: story ? 27 : 23, color: brand.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else if (draft.templateId === "concession-combo") {
    const copyY = story ? 1030 : Math.round(height * 0.55);
    shapes = `${rect(0, 0, width, height, brand.primaryColor)}
      <defs><linearGradient id="productShade" x1="0" y1="0" x2="0" y2="1"><stop offset="30%" stop-color="${brand.primaryColor}" stop-opacity="0"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, copyY + 100, "url(#productShade)")}
      ${rect(margin, copyY - 45, 170, 8, brand.accentColor, 4)}
      ${rect(margin, copyY + (story ? 570 : 470), Math.min(420, contentWidth * 0.58), story ? 82 : 70, brand.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY + 10, width: contentWidth, size: subtitleSize, color: brand.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 125, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: copyY + (story ? 390 : 330), width: contentWidth, size: bodySize, color: brand.textColor, weight: 600, maxLines: 3, opacity: 0.86 })}
      ${textBlock({ value: draft.price, x: margin, y: copyY + (story ? 520 : 430), width: contentWidth, size: priceSize, color: brand.accentColor, weight: 900, maxLines: 1 })}
      ${textBlock({ value: draft.cta, x: margin + Math.min(420, contentWidth * 0.58) / 2, y: copyY + (story ? 623 : 516), width: 370, size: story ? 27 : 23, color: brand.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  } else {
    const copyY = story ? 1030 : Math.round(height * 0.55);
    shapes = `${rect(0, 0, width, height, brand.primaryColor)}
      <defs><linearGradient id="clubShade" x1="0" y1="0" x2="0" y2="1"><stop offset="20%" stop-color="${brand.secondaryColor}" stop-opacity="0.12"/><stop offset="70%" stop-color="${brand.primaryColor}" stop-opacity="0.9"/><stop offset="100%" stop-color="${brand.primaryColor}"/></linearGradient></defs>${rect(0, 0, width, height, "url(#clubShade)")}
      ${rect(margin, copyY - 52, 180, 8, brand.accentColor, 4)}
      ${rect(margin, copyY + (story ? 570 : 465), Math.min(420, contentWidth * 0.58), story ? 82 : 70, brand.accentColor, 8)}`;
    copy = `${textBlock({ value: draft.subtitle, x: margin, y: copyY, width: contentWidth, size: subtitleSize, color: brand.accentColor, weight: 900, maxLines: 2, uppercase: true })}
      ${textBlock({ value: draft.title, x: margin, y: copyY + 120, width: contentWidth, size: titleSize, color: brand.textColor, weight: 900, maxLines: 3 })}
      ${textBlock({ value: draft.price, x: margin, y: copyY + (story ? 380 : 310), width: contentWidth, size: story ? 76 : 64, color: brand.accentColor, weight: 900, maxLines: 2 })}
      ${textBlock({ value: draft.auxiliaryText, x: margin, y: copyY + (story ? 500 : 410), width: contentWidth, size: bodySize, color: brand.textColor, weight: 600, maxLines: 3, opacity: 0.88 })}
      ${textBlock({ value: draft.cta, x: margin + Math.min(420, contentWidth * 0.58) / 2, y: copyY + (story ? 623 : 511), width: 370, size: story ? 27 : 23, color: brand.primaryColor, weight: 900, maxLines: 1, anchor: "middle", uppercase: true })}`;
  }

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}${copy}${footer}</svg>`);
}

async function resizeImage(buffer, width, height, fit = "cover", background = { r: 7, g: 17, b: 31, alpha: 1 }) {
  if (!buffer) return null;
  return sharp(buffer, { failOn: "error" }).rotate().resize(width, height, { fit, position: "centre", background }).png().toBuffer();
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
  const backgroundFit = draft.templateId === "online-ticket" ? "contain" : "cover";
  if (sourceBuffer) {
    const targetHeight = draft.templateId === "online-ticket"
      ? (draft.formatId === "story" ? 820 : Math.round(format.height * 0.48))
      : format.height;
    const renderedSource = await resizeImage(sourceBuffer, format.width, targetHeight, backgroundFit, brand.primaryColor).catch(() => null);
    if (renderedSource) composites.push({ input: renderedSource, top: 0, left: 0 });
  } else if (draft.templateId === "online-ticket") {
    const h = draft.formatId === "story" ? 820 : Math.round(format.height * 0.48);
    composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${format.width}" height="${h}"><rect width="100%" height="100%" fill="${brand.secondaryColor}" fill-opacity=".22"/><rect x="90" y="100" width="900" height="${h - 180}" rx="20" fill="#ffffff" fill-opacity=".08"/><rect x="145" y="160" width="790" height="74" rx="8" fill="#ffffff" fill-opacity=".12"/><rect x="145" y="280" width="350" height="${Math.max(150, h - 390)}" rx="12" fill="${brand.accentColor}" fill-opacity=".92"/><rect x="535" y="280" width="400" height="62" rx="8" fill="#ffffff" fill-opacity=".16"/><rect x="535" y="372" width="310" height="62" rx="8" fill="#ffffff" fill-opacity=".1"/><rect x="535" y="464" width="260" height="62" rx="8" fill="${brand.accentColor}"/></svg>`), top: 0, left: 0 });
  }

  const svg = templateSvg(draft, { ...context, brand });
  composites.push({ input: svg, top: 0, left: 0 });

  const logoBuffer = brand.logoUrl ? await loadImage(brand.logoUrl) : null;
  if (logoBuffer) {
    const logoWidth = draft.formatId === "story" ? 230 : 190;
    const logoHeight = draft.formatId === "story" ? 116 : 96;
    const resizedLogo = await resizeImage(logoBuffer, logoWidth, logoHeight, "contain", { r: 0, g: 0, b: 0, alpha: 0 }).catch(() => null);
    if (resizedLogo) composites.push({ input: resizedLogo, top: draft.formatId === "story" ? 78 : 56, left: draft.formatId === "story" ? 82 : 64 });
  }

  const posterUrl = posterImageForDraft(draft);
  if (posterUrl && posterUrl !== sourceUrl && ["movie-price", "movie-premiere"].includes(draft.templateId)) {
    const posterBuffer = await loadImage(posterUrl);
    if (posterBuffer) {
      const posterWidth = draft.formatId === "story" ? 500 : 330;
      const posterHeight = Math.round(posterWidth * 1.5);
      const poster = await resizeImage(posterBuffer, posterWidth, posterHeight, "cover", brand.primaryColor).catch(() => null);
      if (poster) {
        composites.push({ input: poster, top: draft.formatId === "story" ? 225 : 112, left: format.width - posterWidth - (draft.formatId === "story" ? 82 : 64) });
        composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${posterWidth}" height="${posterHeight}"><rect x="2" y="2" width="${posterWidth - 4}" height="${posterHeight - 4}" fill="none" stroke="${brand.accentColor}" stroke-width="4"/></svg>`), top: draft.formatId === "story" ? 225 : 112, left: format.width - posterWidth - (draft.formatId === "story" ? 82 : 64) });
      }
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

function createHistoryRecord(rendered, input = {}, context = {}, actorUserId = "") {
  const now = new Date().toISOString();
  return {
    id: `social-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    templateId: rendered.draft.templateId,
    templateName: templateById(rendered.draft.templateId).name,
    formatId: rendered.draft.formatId,
    formatName: rendered.format.name,
    width: rendered.format.width,
    height: rendered.format.height,
    outputType: rendered.draft.outputType,
    title: rendered.draft.title,
    imageUrl: String(input.savedImageUrl || ""),
    caption: captionForDraft(rendered.draft, context),
    payload: {
      templateId: rendered.draft.templateId,
      formatId: rendered.draft.formatId,
      outputType: rendered.draft.outputType,
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
      caption: rendered.draft.caption
    },
    createdBy: String(actorUserId || ""),
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  FALLBACK_BRAND,
  SOCIAL_FORMATS,
  SOCIAL_TEMPLATES,
  captionForDraft,
  createHistoryRecord,
  defaultCopy,
  formatById,
  formatMoney,
  minimumMoviePrice,
  normalizeBrand,
  normalizeDraft,
  renderSocialPost,
  sourceImageForDraft,
  templateById,
  wrapLines
};
