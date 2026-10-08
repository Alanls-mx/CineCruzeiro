const React = require("react");
const { fitFontSize } = require("../engine/typography");

const h = React.createElement;

function Root({ width, height, background = "#050b14", children }) {
  return h("div", {
    style: {
      width, height, display: "flex", position: "relative", overflow: "hidden",
      background, color: "#ffffff", fontFamily: "Social Text"
    }
  }, children);
}

function Artwork({ src, width, height, opacity = 1 }) {
  if (!src) return null;
  return h("img", {
    src,
    width,
    height,
    style: { position: "absolute", inset: 0, width, height, objectFit: "cover", opacity }
  });
}

function Layer({ style = {}, children }) {
  const fill = Object.prototype.hasOwnProperty.call(style, "inset")
    ? { inset: 0 }
    : { top: 0, right: 0, bottom: 0, left: 0 };
  return h("div", {
    style: { display: "flex", position: "absolute", ...fill, ...style }
  }, children);
}

function BottomGradient({ start = 32, opacity = 1 }) {
  const middle = Math.min(78, start + 26);
  const solid = Math.min(94, start + 43);
  return h(Layer, {
    style: {
      backgroundImage: `linear-gradient(to bottom, rgba(2,5,10,0) ${start}%, rgba(2,5,10,.76) ${middle}%, rgba(2,5,10,.98) ${solid}%, #02050a 100%)`,
      opacity
    }
  });
}

function SideGradient({ color = "#000000", side = "left", opacity = 0.92 }) {
  const direction = side === "right" ? "to left" : "to right";
  return h(Layer, {
    style: { backgroundImage: `linear-gradient(${direction}, ${color} 0%, ${color} 36%, rgba(0,0,0,0) 84%)`, opacity }
  });
}

function Vignette({ opacity = 0.68 }) {
  return h(Layer, {
    style: { backgroundImage: "radial-gradient(circle at 50% 35%, rgba(0,0,0,0) 35%, rgba(0,0,0,.82) 100%)", opacity }
  });
}

function AutoText({ value, width, preferred, min, lines = 1, color = "#ffffff", weight = 600, align = "center", letterSpacing = 0, lineHeight = 0.98, uppercase = false, style = {} }) {
  const content = uppercase ? String(value || "").toUpperCase() : String(value || "");
  const fontSize = fitFontSize(content, { width, preferred, min, max: preferred, lines, letterSpacing });
  return h("div", {
    style: {
      display: "flex", width, color, fontSize, fontWeight: weight, textAlign: align,
      justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      lineHeight, letterSpacing, whiteSpace: lines === 1 ? "nowrap" : "normal",
      overflow: "hidden", textOverflow: "ellipsis", ...style
    }
  }, content);
}

function Label({ children, color = "#ffffff", size = 28, spacing = 6, style = {} }) {
  return h("div", {
    style: {
      display: "flex", color, fontSize: size, fontWeight: 600, letterSpacing: spacing,
      textTransform: "uppercase", lineHeight: 1, ...style
    }
  }, children);
}

function Rule({ color, width, style = {} }) {
  return h("div", { style: { display: "flex", width, height: 3, backgroundColor: color, opacity: 0.9, ...style } });
}

function CinemaLogo({ src, width, height, style = {} }) {
  if (!src) return null;
  return h("img", { src, width, height, style: { objectFit: "contain", ...style } });
}

function CTA({ text, color = "#ffffff", accent = "#5ca8ff", width, centered = true, compact = false }) {
  return h("div", {
    style: {
      display: "flex", alignItems: "center", justifyContent: centered ? "center" : "flex-start",
      width, gap: 14, color, fontSize: compact ? 24 : 29, fontWeight: 600,
      letterSpacing: compact ? 4 : 6, textTransform: "uppercase", whiteSpace: "nowrap"
    }
  }, [
    h("div", { key: "line", style: { display: "flex", width: compact ? 40 : 58, height: 2, backgroundColor: accent, opacity: 0.9 } }),
    h("span", { key: "text" }, String(text || "CONFIRA AS SESSÕES")),
    h("div", { key: "line2", style: { display: "flex", width: compact ? 40 : 58, height: 2, backgroundColor: accent, opacity: 0.9 } })
  ]);
}

function Website({ value, width, size = 27, color = "#ffffff" }) {
  return h(AutoText, { value, width, preferred: size, min: 18, color, weight: 600, align: "center", letterSpacing: 0.6 });
}

function SessionList({ value, width, color = "#dce9fb", size = 25, centered = true }) {
  if (!String(value || "").trim()) return null;
  return h(AutoText, {
    value, width, preferred: size, min: 18, color, weight: 600,
    align: centered ? "center" : "left", letterSpacing: 3, uppercase: true
  });
}

function PriceBlock({ value, width, accent, fallback, centered = true }) {
  const hasPrice = /(?:R\$|\d)/.test(String(value || "")) && !/CONSULTE|CONFIRA|CONHEÇA/i.test(String(value || ""));
  if (!hasPrice) {
    return h(AutoText, {
      value: fallback || "ESCOLHA SEU HORÁRIO", width,
      preferred: 50, min: 32, lines: 2, color: accent, weight: 900,
      align: centered ? "center" : "left", lineHeight: 0.95, uppercase: true
    });
  }
  return h(AutoText, {
    value, width, preferred: 124, min: 62, color: accent, weight: 900,
    align: centered ? "center" : "left", lineHeight: 0.9, uppercase: true,
    style: { fontFamily: "Social Display" }
  });
}

module.exports = {
  Artwork,
  AutoText,
  BottomGradient,
  CTA,
  CinemaLogo,
  Label,
  Layer,
  PriceBlock,
  Root,
  Rule,
  SessionList,
  SideGradient,
  Vignette,
  Website,
  h
};
