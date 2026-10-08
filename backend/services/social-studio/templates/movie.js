const {
  Artwork, AutoText, BottomGradient, CTA, CinemaLogo, Label, Layer,
  PriceBlock, Root, Rule, SessionList, SideGradient, Vignette, Website, h
} = require("../components");
const { compactDate, compactWebsite } = require("../engine/typography");
const { mix } = require("../engine/palette");

const LAYOUTS = {
  feed_portrait: { margin: 76, contentTop: 610, detail: 126, logoW: 320, logoH: 188, logoBottom: 20, websiteBottom: 218 },
  square: { margin: 70, contentTop: 438, detail: 98, logoW: 280, logoH: 164, logoBottom: 12, websiteBottom: 176 },
  story: { margin: 92, contentTop: 930, detail: 144, logoW: 390, logoH: 228, logoBottom: 62, websiteBottom: 316 }
};

function hasCommercialPrice(value) {
  return /(?:R\$|\d)/.test(String(value || "")) && !/CONSULTE|CONFIRA|CONHEÇA/i.test(String(value || ""));
}

function movieLayout(format) {
  return LAYOUTS[format.id] || LAYOUTS.feed_portrait;
}

function movieCopy(draft) {
  const mode = draft.templateId;
  if (mode === "movie-presale") return { label: "PRÉ-VENDA", detail: compactDate(draft.date) || "EM BREVE", cta: draft.cta || "GARANTA NA PRÉ-VENDA" };
  if (mode === "movie-price") return { label: draft.subtitle || "INGRESSOS", detail: draft.price, cta: draft.cta || "COMPRE AGORA" };
  if (mode === "movie-highlight") return { label: draft.subtitle || "EM CARTAZ", detail: draft.date || "CONFIRA AS SESSÕES", cta: draft.cta || "GARANTA SEU LUGAR" };
  return { label: draft.subtitle || "ESTREIA", detail: compactDate(draft.date) || "EM CARTAZ", cta: draft.cta || "CONFIRA AS SESSÕES" };
}

function cinematicMovie({ draft, format, palette, brand, assets }) {
  const layout = movieLayout(format);
  const copy = movieCopy(draft);
  const contentWidth = format.width - layout.margin * 2;
  const accent = mix(brand.secondaryColor, "#6fb9ff", 0.6);
  const titleColor = mix(palette.accentColor, "#ffffff", 0.2);
  const isPrice = draft.templateId === "movie-price";
  const hasPrice = hasCommercialPrice(copy.detail);
  const detail = isPrice
    ? h(PriceBlock, { value: copy.detail, width: contentWidth, accent, fallback: "ESCOLHA SEU HORÁRIO" })
    : h(AutoText, {
      value: copy.detail, width: contentWidth, preferred: layout.detail, min: format.id === "story" ? 76 : 62,
      color: accent, weight: 900, align: "center", letterSpacing: 1, uppercase: true,
      style: { fontFamily: "Social Display", textShadow: `0 0 22px ${accent}` }
    });
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    h(Artwork, { key: "art", src: assets.artwork, width: format.width, height: format.height }),
    h(Vignette, { key: "vignette", opacity: 0.56 }),
    h(BottomGradient, { key: "gradient", start: format.id === "story" ? 31 : 25, opacity: 1 }),
    h(Layer, { key: "content", style: { inset: "auto", left: layout.margin, right: layout.margin, top: layout.contentTop, flexDirection: "column", alignItems: "center" } }, [
      h(AutoText, { key: "title", value: draft.title, width: contentWidth, preferred: format.id === "story" ? 56 : 46, min: 28, color: titleColor, weight: 900, align: "center", letterSpacing: 6, uppercase: true }),
      h(Label, { key: "label", color: accent, size: format.id === "story" ? 45 : 37, spacing: format.id === "story" ? 10 : 8, style: { marginTop: 24, textShadow: `0 0 14px ${accent}` } }, isPrice && !hasPrice ? "SESSÕES DISPONÍVEIS" : copy.label),
      h("div", { key: "detail", style: { display: "flex", width: contentWidth, marginTop: 20, justifyContent: "center" } }, detail),
      h(Rule, { key: "rule", color: accent, width: contentWidth * 0.84, style: { marginTop: 22 } }),
      h(AutoText, { key: "cinema", value: `NO ${brand.name}`, width: contentWidth, preferred: format.id === "story" ? 45 : 36, min: 25, color: accent, weight: 900, align: "center", letterSpacing: 8, uppercase: true, style: { marginTop: 22, textShadow: `0 0 12px ${accent}` } }),
      h("div", { key: "sessions", style: { display: "flex", marginTop: 19 } }, h(SessionList, { value: draft.auxiliaryText, width: contentWidth, color: "#dbe7f7", size: format.id === "story" ? 28 : 23 })),
      h("div", { key: "cta", style: { display: "flex", marginTop: 20 } }, h(CTA, { text: copy.cta, width: contentWidth, accent, compact: format.id === "square" }))
    ]),
    h(Layer, { key: "website", style: { inset: "auto", left: layout.margin, right: layout.margin, bottom: layout.websiteBottom, justifyContent: "center" } }, h(Website, { value: compactWebsite(brand.posterWebsite || brand.website), width: contentWidth, size: format.id === "story" ? 31 : 25 })),
    h(Layer, { key: "logo", style: { inset: "auto", left: 0, right: 0, bottom: layout.logoBottom, justifyContent: "center" } }, h(CinemaLogo, { src: assets.logo, width: layout.logoW, height: layout.logoH }))
  ]);
}

function impactMovie({ draft, format, palette, brand, assets }) {
  const margin = format.id === "story" ? 88 : 70;
  const width = format.width - margin * 2;
  const accent = palette.accentColor;
  const copy = movieCopy(draft);
  const alignRight = draft.imagePositionX < 44;
  const side = alignRight ? "right" : "left";
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    h(Artwork, { key: "art", src: assets.artwork, width: format.width, height: format.height }),
    h(SideGradient, { key: "side", color: brand.primaryColor, side, opacity: 0.98 }),
    h(BottomGradient, { key: "bottom", color: brand.primaryColor, start: 66, opacity: 0.9 }),
    h(Layer, { key: "copy", style: { inset: "auto", top: format.id === "story" ? 520 : 310, left: alignRight ? format.width - margin - width * 0.72 : margin, width: width * 0.72, flexDirection: "column", alignItems: alignRight ? "flex-end" : "flex-start" } }, [
      h(Label, { key: "label", color: accent, size: format.id === "story" ? 38 : 30, spacing: 5 }, copy.label),
      h(AutoText, { key: "title", value: draft.title, width: width * 0.72, preferred: format.id === "story" ? 106 : 80, min: 48, lines: 3, color: "#ffffff", weight: 900, align: alignRight ? "right" : "left", lineHeight: 0.88, style: { fontFamily: "Social Display", marginTop: 28 } }),
      h("div", { key: "detail", style: { display: "flex", marginTop: 42, width: width * 0.72 } }, draft.templateId === "movie-price"
        ? h(PriceBlock, { value: copy.detail, width: width * 0.72, accent, centered: false })
        : h(AutoText, { value: copy.detail, width: width * 0.72, preferred: 60, min: 34, color: accent, weight: 900, align: alignRight ? "right" : "left", uppercase: true })),
      h("div", { key: "sessions", style: { display: "flex", marginTop: 32 } }, h(SessionList, { value: draft.auxiliaryText, width: width * 0.72, color: "#ffffff", size: 24, centered: false })),
      h("div", { key: "cta", style: { display: "flex", marginTop: 34 } }, h(CTA, { text: copy.cta, width: width * 0.72, accent, centered: false, compact: true }))
    ]),
    h(Layer, { key: "logo", style: { inset: "auto", left: margin, right: margin, bottom: format.id === "story" ? 78 : 34, justifyContent: alignRight ? "flex-start" : "flex-end" } }, h(CinemaLogo, { src: assets.logo, width: format.id === "story" ? 360 : 300, height: format.id === "story" ? 210 : 175 }))
  ]);
}

function cleanMovie({ draft, format, palette, brand, assets }) {
  const story = format.id === "story";
  const margin = story ? 82 : 62;
  const panelTop = story ? 1160 : format.id === "square" ? 555 : 730;
  const contentWidth = format.width - margin * 2;
  const copy = movieCopy(draft);
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    h(Artwork, { key: "art", src: assets.artwork, width: format.width, height: format.height }),
    h(Layer, { key: "panel", style: { top: panelTop, backgroundColor: brand.primaryColor, flexDirection: "column", padding: `${story ? 54 : 40}px ${margin}px`, alignItems: draft.alignment === "center" ? "center" : "flex-start" } }, [
      h(Label, { key: "label", color: palette.accentColor, size: story ? 35 : 27, spacing: 5 }, copy.label),
      h(AutoText, { key: "title", value: draft.title, width: contentWidth, preferred: story ? 78 : 62, min: 38, lines: 2, color: "#ffffff", weight: 900, align: draft.alignment === "center" ? "center" : "left", lineHeight: 0.92, style: { fontFamily: "Social Display", marginTop: 18 } }),
      h("div", { key: "detail", style: { display: "flex", marginTop: 25 } }, draft.templateId === "movie-price"
        ? h(PriceBlock, { value: copy.detail, width: contentWidth, accent: palette.accentColor, centered: draft.alignment === "center" })
        : h(AutoText, { value: copy.detail, width: contentWidth, preferred: story ? 55 : 44, min: 28, color: palette.accentColor, weight: 900, align: draft.alignment === "center" ? "center" : "left", uppercase: true })),
      h("div", { key: "sessions", style: { display: "flex", marginTop: 24 } }, h(SessionList, { value: draft.auxiliaryText, width: contentWidth, centered: draft.alignment === "center" })),
      h("div", { key: "cta", style: { display: "flex", marginTop: 28 } }, h(CTA, { text: copy.cta, width: contentWidth, accent: palette.accentColor, centered: draft.alignment === "center", compact: true }))
    ]),
    h(Layer, { key: "logo", style: { inset: "auto", right: margin, bottom: story ? 72 : 28, justifyContent: "flex-end" } }, h(CinemaLogo, { src: assets.logo, width: story ? 300 : 250, height: story ? 175 : 145 }))
  ]);
}

function renderMovieTemplate(props) {
  if (props.draft.style === "impact") return impactMovie(props);
  if (["clean", "minimal"].includes(props.draft.style)) return cleanMovie(props);
  return cinematicMovie(props);
}

module.exports = { renderMovieTemplate };
