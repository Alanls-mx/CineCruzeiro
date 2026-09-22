const { wrapText } = require("../scene/factory");
const { campaignHierarchy } = require("./hierarchy");

function polishComposition(input) {
  const scene = structuredClone(input);
  const margin = scene.width * .065;
  const top = scene.formatId === "story" ? scene.height * .075 : scene.height * .035;
  const bottom = scene.height * (scene.formatId === "story" ? .885 : .965);
  const hierarchy = campaignHierarchy(scene.sourceDraft);
  const texts = scene.elements.filter(element => element.visible !== false && element.type === "text");
  const logo = scene.elements.find(element => element.role === "logo" && element.visible !== false);
  const footerTop = bottom - scene.height * .065;
  for (const element of texts) {
    element.width = Math.min(element.width, scene.width - margin * 2);
    element.x = Math.round(Math.max(margin, Math.min(scene.width - margin - element.width, element.x)));
    element.y = Math.round(Math.max(top, Math.min(bottom - element.height, element.y)));
    const preferred = element.id === hierarchy.primary ? Math.max(element.fontSize, 76) : element.id === "cta" ? Math.max(element.fontSize, 32) : element.fontSize;
    Object.assign(element, wrapText(element.text, element.width, element.height, preferred, element.id === "title" ? 4 : 6));
    if (!["cinema", "website"].includes(element.id)) element.hierarchy = element.id === hierarchy.primary ? "primary" : element.id === "title" || element.id === "detail" ? "secondary" : "tertiary";
  }
  const cinema = texts.find(element => element.id === "cinema");
  const website = texts.find(element => element.id === "website");
  const footerWidth = scene.width * (logo ? .55 : .87);
  for (const [element, offset, size] of [[cinema, 0, 27], [website, .034, 24]]) {
    if (!element) continue;
    Object.assign(element, { x: margin, y: footerTop + scene.height * offset, width: footerWidth, height: scene.height * .03, align: "left" });
    Object.assign(element, wrapText(element.text, element.width, element.height, size, 1));
  }
  if (logo) Object.assign(logo, { x: scene.width - margin - scene.width * .25, y: footerTop - scene.height * .013, width: scene.width * .25, height: scene.height * .078, focusX: 100, focusY: 50 });
  scene.elements = scene.elements.filter(element => element.id !== "divider");
  const dividerY = footerTop - scene.height * .027;
  scene.elements.push({ id: "divider", name: "Divisor da assinatura", role: "branding", type: "shape", x: margin, y: dividerY, width: scene.width - margin * 2, height: 1, fill: "#c8d1dc", opacity: .3, visible: true, locked: true });
  const content = texts.filter(element => !["cinema", "website"].includes(element.id)).sort((a, b) => a.y - b.y);
  for (const element of content) {
    if (element.y + element.height > dividerY - 12) {
      element.height = Math.max(20, dividerY - 12 - element.y);
      Object.assign(element, wrapText(element.text, element.width, element.height, element.fontSize, 6));
    }
  }
  const art = scene.elements.find(element => element.id === "artwork" && element.visible !== false);
  if (art && art.y + art.height > dividerY) {
    const height = Math.max(1, dividerY - art.y);
    for (const element of scene.elements.filter(element => ["artwork", "poster-glow", "ambient-shadow", "contact-shadow"].includes(element.id))) element.height = height;
  }
  return scene;
}

module.exports = { polishComposition };
