const { compactDate, compactWebsite, visualLength } = require("../engine/typography");
const { mix } = require("../engine/palette");
const { normalizeScene } = require("./schema");
const legacy = require("../../socialStudioService");
const { normalizeComposition } = require("../composition-engine/config");
const { DIRECTIONS, directionPlan } = require("../composition-engine/direction");

// Text stays outside the sharp subject zone; image edges dissolve behind the copy.
const LAYOUTS = {
  cinematic: { art: [0, 0, 1, .53], copy: [.07, .56, .86, .29], align: "center" },
  impact: { art: [.43, .045, .52, .68], copy: [.06, .08, .32, .63], align: "left", detail: [.06, .755, .88, .1] },
  clean: { art: [.055, .055, .46, .74], copy: [.57, .09, .375, .68], align: "left" },
  minimal: { art: [.15, .04, .7, .57], copy: [.1, .645, .8, .20], align: "center" },
  immersive: { art: [.02, 0, .96, .66], copy: [.08, .64, .84, .215], align: "center" },
  "poster-blend": { art: [.06, .01, .88, .63], copy: [.1, .65, .8, .20], align: "center" },
  "hero-cinematic": { art: [.20, 0, .80, .66], copy: [.06, .65, .88, .20], align: "left" },
  "split-cinematic": { art: [.39, .015, .61, .75], copy: [.055, .15, .32, .54], align: "left", detail: [.06, .775, .88, .075] },
  "full-bleed": { art: [0, 0, 1, .70], copy: [.07, .63, .86, .22], align: "left" },
  editorial: { art: [0, 0, .63, .72], copy: [.67, .08, .28, .63], align: "left", detail: [.06, .77, .88, .08] },
  ...Object.fromEntries(Object.entries(DIRECTIONS).filter(([id])=>!["editorial","full-bleed"].includes(id)).map(([id,plan])=>[id,{art:plan.art,copy:plan.copy,align:plan.align}]))
};

function box(rect, width, height) {
  return { x: Math.round(rect[0] * width), y: Math.round(rect[1] * height), width: Math.round(rect[2] * width), height: Math.round(rect[3] * height) };
}

function base(id, type, bounds, props = {}) {
  return { id, name: id, role: id, type, ...bounds, opacity: 1, visible: true, ...props };
}

function wrapText(value, width, height, preferred, maxLines = 3) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  for (let size = Math.floor(preferred); size >= 12; size--) {
    const lines = [];
    let line = "";
    let fits = true;
    for (const word of words) {
      if (visualLength(word) * size > width) { fits = false; break; }
      const next = line ? `${line} ${word}` : word;
      if (line && visualLength(next) * size > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (fits && lines.length <= maxLines && lines.length * size * 1.12 <= height) return { text: lines.join("\n"), fontSize: size };
  }
  const chunks = [];
  let line = "";
  for (const character of words.join(" ")) {
    if (visualLength(line + character) * 12 > width && line) { chunks.push(line.trim()); line = ""; }
    line += character;
  }
  if (line) chunks.push(line.trim());
  return { text: chunks.join("\n"), fontSize: 12 };
}

function text(id, name, value, bounds, options = {}) {
  const font = wrapText(value, bounds.width, bounds.height, options.fontSize || 44, options.lines || 3);
  return base(id, "text", bounds, {
    name, ...font, fontFamily: options.display ? "Social Display" : "Social Text",
    fontWeight: options.display ? 900 : 600, fill: options.fill || "#ffffff",
    align: options.align || "left", lineHeight: 1.12, letterSpacing: 0,
    ...options, fontSize: font.fontSize
  });
}

function movieCopy(draft) {
  if (draft.templateId === "movie-presale") return { label: draft.subtitle || "PRÉ-VENDA", detail: compactDate(draft.date) || "EM BREVE" };
  if (draft.templateId === "movie-price") return { label: draft.subtitle || "INGRESSOS", detail: draft.priceInfo?.valid || legacy.hasCommercialPrice(draft.price) ? draft.price : "CONFIRA AS SESSÕES" };
  if (draft.templateId === "movie-highlight") return { label: draft.subtitle || "EM CARTAZ", detail: draft.date || (draft.content?.releaseScope==='international' ? '' : "CONFIRA AS SESSÕES") };
  return { label: draft.subtitle || "ESTREIA", detail: compactDate(draft.date) || "EM BREVE" };
}

function buildEditableScene({ draft, format, palette, brand, sourceUrl = "", backgroundUrl = "", fullBleed = false, logoUrl = "", analysis = null }) {
  const w = format.width;
  const h = format.height * (format.id === "story" ? .86 : 1);
  const topInset = format.id === "story" ? format.height * .04 : 0;
  const style = LAYOUTS[draft.style] ? draft.style : "cinematic";
  let layout = LAYOUTS[style];
  const composition = normalizeComposition(draft.composition, draft.genreProfile?.id);
  const cinematic = composition.enabled && Boolean(sourceUrl);
  const directed = cinematic ? directionPlan(draft, analysis, { fullBleed }) : null;
  if (directed) layout = directed;
  if (cinematic && style === "cinematic") layout = { art: [0, 0, 1, .65], copy: [.07, .65, .86, .205], align: "center" };
  const light = style === "clean" && !cinematic;
  const background = light ? mix(palette.accentColor, "#ffffff", .94) : mix(palette.dominantColor, "#000000", .83);
  const foreground = light ? "#151a22" : "#ffffff";
  const accent = light ? mix(palette.accentColor, "#000000", .62) : mix(palette.accentColor, "#ffffff", .35);
  const muted = light ? "#465260" : "#c8d1dc";
  const elements = [];
  const art = box(layout.art, w, h);
  if (!cinematic && layout.copy[0] < layout.art[0] + layout.art[2] && layout.art[0] < layout.copy[0] + layout.copy[2] && layout.copy[1] > layout.art[1]) art.height = Math.min(art.height, Math.round(layout.copy[1] * h) - art.y);
  const copyBox = box(sourceUrl ? layout.copy : [.1, .12, .8, .6], w, h);
  const align = draft.alignment === "center" ? "center" : layout.align;
  const presets = { center: [50, 50], left: [0, 50], right: [100, 50], top: [50, 0], bottom: [50, 100] };
  const focus = presets[draft.imagePreset] || [draft.imagePositionX ?? 50, draft.imagePositionY ?? 50];
  const framing = directed?.framing || { background: { focusX: 75, focusY: 35, scale: 1.4, ...draft.artDirection?.background }, hero: { focusX:focus[0], focusY:focus[1], scale:1, ...draft.artDirection?.hero } };
  if (directed && (presets[draft.imagePreset] || draft.imagePositionX !== undefined && draft.imagePositionX !== 50 || draft.imagePositionY !== undefined && draft.imagePositionY !== 50)) framing.hero={...framing.hero,focusX:focus[0],focusY:focus[1],...draft.artDirection?.hero};
  const mode = directed?.heroMode || draft.artDirection?.heroMode || "edge-dissolve";
  const mask = mode === "rectangle" ? "none" : mode === "soft-rectangle" || mode === "floating" ? "fade-all" : mode === "full-blend" ? "fade-all" : composition.mask;
  const blend = mode === "rectangle" ? 0 : mode === "soft-rectangle" ? 15 : mode === "floating" ? 22 : mode === "full-blend" ? 95 : composition.blend;

  const fullBounds = { x: 0, y: -topInset, width: w, height: format.height };
  const ambientFx = { color: palette.dominantColor, blend: 0, grain: 0, glow: 0, vignette: 0, overlay: "none", colorWash: 0 };
  if (cinematic) {
    elements.push(base("background-blur", "image", fullBounds, { name: "Fundo cinematográfico", role: "ambient", src: backgroundUrl || sourceUrl, fit: "cover", locked: true, focusX:framing.background.focusX,focusY:framing.background.focusY,
      effects: { ...composition, ...ambientFx, layer: "background", brightness: fullBleed ? 1 : composition.brightness, saturation: composition.saturation, contrast: composition.contrast, blur: fullBleed ? 0 : composition.blur, ...framing.background, scale: fullBleed ? (draft.artDirection?.background?.scale || 1) : framing.background.scale } }));
    elements.push(base("background-wash", "image", fullBounds, { name: "Cor ambiente", role: "ambient", src: backgroundUrl || sourceUrl, locked: true, effects: { ...ambientFx, layer: "wash", colorWash: composition.colorWash } }));
    elements.push(base("atmosphere", "image", fullBounds, { name: "Atmosfera de fundo", role: "ambient", src: sourceUrl, locked: true, effects: { ...ambientFx, layer: "atmosphere", overlay: composition.overlay, grain: composition.grain } }));
    if (draft.artDirection?.secondary && backgroundUrl && backgroundUrl !== sourceUrl) elements.push(base("secondary-artwork","image",{...art,x:Math.max(0,art.x-w*.03),y:Math.max(0,art.y-h*.025)}, {name:"Arte secundária",role:"ambient",src:backgroundUrl,fit:"cover",locked:true,opacity:.16,effects:{...ambientFx,blur:10,mask:"fade-all",blend:95,scale:1.15}}));
    if (!fullBleed) {
      const shadow = mode === "floating" ? Math.max(35,draft.artDirection?.shadow || 0) : draft.artDirection?.shadow ?? 25;
      if (shadow) for (const layer of ["ambient-shadow","contact-shadow"]) elements.push(base(layer,"image",art,{name:layer==="ambient-shadow"?"Sombra ambiente":"Sombra de contato",role:"ambient",src:sourceUrl,fit:"contain",locked:true,focusX:framing.hero.focusX,focusY:framing.hero.focusY,effects:{...ambientFx,...framing.hero,layer,mask,blend,shadow}}));
      if (composition.glow) elements.push(base("poster-glow", "image", art, { name: "Luz do pôster", role: "ambient", src: sourceUrl, fit: "contain", locked: true,focusX:framing.hero.focusX,focusY:framing.hero.focusY,
        effects: { ...ambientFx,...framing.hero, layer: "glow", color: palette.accentColor, mask, blend, glow: composition.glow*(directed?.glowScale||1) } }));
    }
  }
  if (style === "impact") {
    elements.push(base("accent-rail", "shape", { x: 0, y: 0, width: 12, height: h }, { name: "Faixa de cor", fill: accent, locked: true }));
  }
  if (sourceUrl) elements.push(base("artwork", "image", art, {
    name: cinematic ? "Pôster principal" : "Arte original", role: "background", src: sourceUrl, fit: "contain",
    ...(cinematic ? { effects: { ...ambientFx,...framing.hero, layer: "image", mask, blend } } : {}),
    focusX: framing.hero.focusX, focusY: framing.hero.focusY, locked: true, required: true, keepRatio: true,hierarchy:"primary"
  }));
  if (cinematic) {
    if (fullBleed) elements.find((item) => item.id === "artwork").visible = false;
    if(draft.artDirection?.foreground && draft.artDirection.foreground!=="none") elements.push(base("foreground-atmosphere","image",fullBounds,{name:"Primeiro plano",role:"ambient",src:sourceUrl,locked:true,opacity:.65,effects:{...ambientFx,layer:"atmosphere",overlay:draft.artDirection.foreground}}));
    elements.push(base("vignette", "image", fullBounds, { name: "Vinheta", role: "ambient", src: sourceUrl, locked: true, effects: { ...ambientFx, layer: "vignette", vignette: composition.vignette } }));
    // Localized contrast zone. The renderer measures the image to tune its opacity.
    const veil = { x: 0, y: Math.max(0, copyBox.y - h * .045), width: w, height: Math.min(h - copyBox.y + h * .045, copyBox.height + h * .08) };
    const lateral = copyBox.width < w * .5;
    if (lateral) { veil.x = copyBox.x > w * .5 ? copyBox.x - w * .045 : 0; veil.y = 0; veil.width = copyBox.x > w * .5 ? w - veil.x : copyBox.x + copyBox.width + w * .075; veil.height = h; }
    elements.push(base("copy-contrast", "gradient", veil, { name: "Contraste do texto", role: "contrast", locked: true, direction: lateral ? (copyBox.x > w * .5 ? "left" : "right") : "bottom", stops: [{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: .15, color: "rgba(0,0,0,0.5)" }, { offset: .85, color: "rgba(0,0,0,0.5)" }, { offset: 1, color: "rgba(0,0,0,0)" }] }));
    elements.push(base("footer-contrast", "gradient", { x: 0, y: h * .84, width: w, height: format.height - h * .84 - topInset }, { name: "Contraste da assinatura", role: "contrast", locked: true, direction: "bottom", stops: [{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: .4, color: "rgba(0,0,0,0.78)" }, { offset: 1, color: "rgba(0,0,0,0.82)" }] }));
  }

  const isMovie = draft.templateId.startsWith("movie-");
  const copy = isMovie ? movieCopy(draft) : {
    label: draft.subtitle || (draft.templateId === "club-plan" ? "SEU CLUBE DE CINEMA" : draft.templateId === "concession-combo" ? "BOMBONIERE" : "BILHETERIA DIGITAL"),
    detail: draft.price || (draft.templateId === "online-ticket" ? "ESCOLHA SUA SESSÃO" : "CONHEÇA AS OPÇÕES")
  };
  const priceDetail = ["movie-price", "concession-combo", "club-plan"].includes(draft.templateId);
  const rows = [
    { id: "subtitle", name: "Chamada", value: copy.label, weight: .65, size: 32, color: accent, lines: 2 },
    { id: "title", name: "Título", value: draft.title, weight: 1.8, size: 88 * (draft.titleScale || 100) / 100, color: foreground, display: true, lines: 4, required: true },
    ...(!layout.detail ? [{ id: "detail", name: "Data ou preço", value: copy.detail, weight: 1.2, size: 84, color: accent, display: true, lines: 3 }] : []),
    ...(draft.auxiliaryText ? [{ id: "description", name: "Informações", value: draft.auxiliaryText, weight: 1.3, size: 32, color: muted, lines: 6 }] : []),
    { id: "cta", name: "Chamada final", value: draft.cta || "CONFIRA AS SESSÕES", weight: .7, size: 32, color: foreground, lines: 2 }
  ];
  const gap = Math.round(Math.min(14, copyBox.height * .027));
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const available = copyBox.height - gap * (rows.length - 1);
  let y = copyBox.y;
  rows.forEach((row) => {
    const height = Math.floor(available * row.weight / totalWeight);
    const bounds = directed?.slots[row.id] ? box(directed.slots[row.id],w,h) : { x: copyBox.x, y, width: copyBox.width, height };
    const primary = directed && (directed.datePrimary ? row.id === "detail" : row.id === "title");
    elements.push(text(row.id, row.name, row.value, bounds, {
      fontSize: directed ? (primary ? 160 : row.id === "title" ? 85 : row.id === "detail" ? 90 : 34) * (row.id === "title" ? (draft.titleScale || 100) / 100 : 1) : row.size, fill: row.color, display: row.display, align, lines: primary ? 3 : row.lines,
      hierarchy:primary?"primary":["title","detail"].includes(row.id)?"secondary":"tertiary",
      required: row.required || row.id === "detail", role: row.id === "detail" ? (priceDetail ? "price" : "date") : row.id
    }));
    y += height + gap;
  });
  if (layout.detail) {
    const band = box(layout.detail, w, h);
    elements.push(base("detail-band", "shape", band, { name: "Faixa de destaque", fill: accent, locked: true }));
    elements.push(text("detail", "Data ou preço", copy.detail, { x: band.x + 22, y: band.y + 8, width: band.width - 44, height: band.height - 16 }, {
      fontSize: 96, fill: "#10141b", display: true, align: "center", lines: 2, role: priceDetail ? "price" : "date", required: true
    }));
  }

  const footer = box(directed?.footer || [.07, .885, .86, .085], w, h);
  if (!directed) elements.push(base("divider", "shape", { x: footer.x, y: footer.y - 18, width: footer.width, height: 2 }, { name: "Divisor", fill: accent, locked: true }));
  const logoWidth = Math.round(Math.min(footer.width * .35, 250));
  if (logoUrl) elements.push(base("logo", "image", directed ? box(directed.logo,w,h) : {
    x: footer.x + footer.width - logoWidth, y: footer.y, width: logoWidth, height: footer.height
  }, { name: "Assinatura do cinema", role: "logo", src: logoUrl, fit: "contain", focusX: directed ? 50 : 100, focusY: 50, protected: true, required: true, keepRatio: true,hierarchy:"branding" }));
  const footerTextWidth = footer.width * (logoUrl && !directed ? .6 : 1);
  elements.push(text("cinema", "Cinema", brand.name, { x: footer.x, y: footer.y, width: footerTextWidth, height: footer.height * .45 }, { fontSize: 30, fill: foreground, required: true, protected: true, lines: 1,hierarchy:"branding" }));
  const website = compactWebsite(brand.posterWebsite || brand.website);
  if (website) elements.push(text("website", "Site", website, { x: footer.x, y: footer.y + footer.height * .5, width: footerTextWidth, height: footer.height * .45 }, { fontSize: 25, fill: muted, required: true, protected: true, lines: 1 }));

  const { entities, ...sourceDraft } = draft;
  return normalizeScene({ id: `scene-${draft.templateId}-${format.id}`, templateId: draft.templateId, formatId: format.id,
    width: w, height: format.height, backgroundColor: background, motion: draft.motion, elements: elements.map((element) => ({ ...element, y: element.y + topInset })), sourceDraft, createdAt: new Date().toISOString() });
}

module.exports = { buildEditableScene, LAYOUTS, wrapText };
