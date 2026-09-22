const {
  Artwork, AutoText, BottomGradient, CTA, CinemaLogo, Label, Layer,
  PriceBlock, Root, Rule, Website, h
} = require("../components");
const { compactWebsite } = require("../engine/typography");
const { mix } = require("../engine/palette");

function commercialMetrics(format) {
  if (format.id === "story") return { margin: 86, top: 860, title: 100, logoW: 340, logoH: 198 };
  if (format.id === "square") return { margin: 64, top: 410, title: 74, logoW: 260, logoH: 152 };
  return { margin: 68, top: 560, title: 82, logoW: 290, logoH: 170 };
}

function renderConcession({ draft, format, palette, brand, assets }) {
  const metrics = commercialMetrics(format);
  const width = format.width - metrics.margin * 2;
  const accent = mix(palette.accentColor, brand.accentColor, 0.45);
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    h(Artwork, { key: "art", src: assets.artwork, width: format.width, height: format.height }),
    h(BottomGradient, { key: "gradient", start: format.id === "story" ? 29 : 23, opacity: 1 }),
    h(Layer, { key: "copy", style: { inset: "auto", left: metrics.margin, right: metrics.margin, top: metrics.top, flexDirection: "column", alignItems: "flex-start" } }, [
      h(Label, { key: "label", color: accent, size: format.id === "story" ? 36 : 29, spacing: 5 }, draft.subtitle || "SABOR PARA A SUA SESSÃO"),
      h(AutoText, { key: "title", value: draft.title, width, preferred: metrics.title, min: 44, lines: 2, color: "#ffffff", weight: 900, align: "left", lineHeight: 0.9, style: { fontFamily: "Social Display", marginTop: 24 } }),
      h(AutoText, { key: "description", value: draft.auxiliaryText, width, preferred: format.id === "story" ? 36 : 29, min: 22, lines: 3, color: "#e4edf8", weight: 600, align: "left", lineHeight: 1.12, style: { marginTop: 24 } }),
      h("div", { key: "price", style: { display: "flex", width, marginTop: 34 } }, h(PriceBlock, { value: draft.price, width, accent, fallback: "CONFIRA NA BOMBONIERE", centered: false })),
      h("div", { key: "cta", style: { display: "flex", marginTop: 34 } }, h(CTA, { text: draft.cta, width, accent, centered: false, compact: true }))
    ]),
    h(Layer, { key: "logo", style: { inset: "auto", right: metrics.margin, bottom: format.id === "story" ? 72 : 30, justifyContent: "flex-end" } }, h(CinemaLogo, { src: assets.logo, width: metrics.logoW, height: metrics.logoH }))
  ]);
}

function renderClub({ draft, format, palette, brand, assets }) {
  const metrics = commercialMetrics(format);
  const width = format.width - metrics.margin * 2;
  const accent = brand.accentColor;
  const benefits = String(draft.auxiliaryText || "").split(/\s*[•|]\s*/).filter(Boolean).slice(0, 4);
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    h(Layer, { key: "wash", style: { backgroundImage: `linear-gradient(145deg, ${brand.primaryColor} 0%, ${mix(palette.secondaryColor, brand.secondaryColor, 0.55)} 58%, ${brand.primaryColor} 100%)` } }),
    h(Layer, { key: "watermark", style: { inset: "auto", right: format.id === "story" ? -34 : -22, bottom: format.id === "story" ? 330 : 225, justifyContent: "flex-end", color: brand.secondaryColor, fontFamily: "Social Display", fontSize: format.id === "story" ? 260 : 190, fontWeight: 900, lineHeight: 0.8, opacity: 0.12 } }, "CLUBE"),
    h(Layer, { key: "copy", style: { inset: "auto", left: metrics.margin, right: metrics.margin, top: format.id === "story" ? 330 : 190, flexDirection: "column", alignItems: "flex-start" } }, [
      h(Label, { key: "label", color: accent, size: format.id === "story" ? 38 : 30, spacing: 6 }, draft.subtitle || "CINEMA TODO MÊS"),
      h(AutoText, { key: "title", value: draft.title, width, preferred: format.id === "story" ? 124 : 98, min: 56, lines: 2, color: "#ffffff", weight: 900, align: "left", lineHeight: 0.88, style: { fontFamily: "Social Display", marginTop: 28 } }),
      h("div", { key: "price", style: { display: "flex", width, marginTop: 40 } }, h(PriceBlock, { value: draft.price, width, accent, fallback: "CONHEÇA OS PLANOS", centered: false })),
      h(Rule, { key: "rule", color: accent, width: width * 0.76, style: { marginTop: 42 } }),
      h("div", { key: "benefits", style: { display: "flex", flexDirection: "column", gap: 18, marginTop: 34, width } }, benefits.map((benefit, index) => h("div", { key: `${index}-${benefit}`, style: { display: "flex", alignItems: "center", gap: 18, color: "#ffffff", fontSize: format.id === "story" ? 32 : 27, fontWeight: 600 } }, [
        h("div", { key: "dot", style: { display: "flex", width: 10, height: 10, borderRadius: 5, backgroundColor: accent } }),
        h("span", { key: "text" }, benefit)
      ]))),
      h("div", { key: "cta", style: { display: "flex", marginTop: 48 } }, h(CTA, { text: draft.cta, width, accent, centered: false }))
    ]),
    h(Layer, { key: "website", style: { inset: "auto", left: metrics.margin, bottom: format.id === "story" ? 250 : 180 } }, h(Website, { value: compactWebsite(brand.posterWebsite || brand.website), width: width * 0.58, size: format.id === "story" ? 28 : 23 })),
    h(Layer, { key: "logo", style: { inset: "auto", right: metrics.margin, bottom: format.id === "story" ? 68 : 24, justifyContent: "flex-end" } }, h(CinemaLogo, { src: assets.logo, width: metrics.logoW, height: metrics.logoH }))
  ]);
}

function renderOnlineTicket({ draft, format, palette, brand, assets }) {
  const metrics = commercialMetrics(format);
  const width = format.width - metrics.margin * 2;
  const accent = brand.accentColor;
  return h(Root, { width: format.width, height: format.height, background: brand.primaryColor }, [
    assets.artwork ? h(Artwork, { key: "art", src: assets.artwork, width: format.width, height: format.height, opacity: 0.42 }) : null,
    h(Layer, { key: "wash", style: { backgroundImage: `linear-gradient(135deg, ${brand.primaryColor} 12%, ${mix(palette.secondaryColor, brand.secondaryColor, 0.6)} 100%)`, opacity: 0.92 } }),
    h(Layer, { key: "copy", style: { inset: "auto", left: metrics.margin, right: metrics.margin, top: format.id === "story" ? 420 : 270, flexDirection: "column", alignItems: "flex-start" } }, [
      h(Label, { key: "label", color: accent, size: format.id === "story" ? 38 : 30, spacing: 6 }, draft.subtitle || "BILHETERIA DIGITAL"),
      h(AutoText, { key: "title", value: draft.title, width, preferred: format.id === "story" ? 112 : 86, min: 48, lines: 3, color: "#ffffff", weight: 900, align: "left", lineHeight: 0.9, style: { fontFamily: "Social Display", marginTop: 34 } }),
      h(Rule, { key: "rule", color: accent, width: width * 0.7, style: { marginTop: 42 } }),
      h(AutoText, { key: "steps", value: draft.auxiliaryText, width, preferred: format.id === "story" ? 37 : 30, min: 23, lines: 3, color: "#e5edf7", weight: 600, align: "left", lineHeight: 1.16, style: { marginTop: 36 } }),
      h("div", { key: "cta", style: { display: "flex", marginTop: 50 } }, h(CTA, { text: draft.cta, width, accent, centered: false }))
    ]),
    h(Layer, { key: "website", style: { inset: "auto", left: metrics.margin, bottom: format.id === "story" ? 250 : 180 } }, h(Website, { value: compactWebsite(brand.posterWebsite || brand.website), width: width * 0.58, size: format.id === "story" ? 28 : 23 })),
    h(Layer, { key: "logo", style: { inset: "auto", right: metrics.margin, bottom: format.id === "story" ? 68 : 24, justifyContent: "flex-end" } }, h(CinemaLogo, { src: assets.logo, width: metrics.logoW, height: metrics.logoH }))
  ]);
}

module.exports = { renderClub, renderConcession, renderOnlineTicket };
