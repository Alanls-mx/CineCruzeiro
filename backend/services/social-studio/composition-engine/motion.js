const { renderSocialScene } = require("../scene/renderer");
const { dataUrl } = require("../engine/assets");
const { normalizeMotion } = require("./config");

// Full-canvas transparent planes preserve the exact static coordinates and raster effects.
// A future video encoder can consume these planes and the same timing descriptor.
async function createMotionPreview(scene, options) {
  const groups = { background: [], hero: [], lighting: [], foreground: [] };
  for (const element of scene.elements) {
    const group = [
      "background-blur",
      "background-wash",
      "atmosphere",
      "secondary-artwork",
    ].includes(element.id)
      ? "background"
      : ["artwork", "poster-glow", "ambient-shadow", "contact-shadow"].includes(
            element.id,
          )
        ? "hero"
        : element.role === "ambient"
          ? "lighting"
          : "foreground";
    groups[group].push(element);
  }
  const layers = [];
  for (const [role, elements] of Object.entries(groups)) {
    if (!elements.length && role !== "background") continue;
    const rendered = await renderSocialScene(
      { ...scene, elements },
      { ...options, outputType: "png", transparent: role !== "background" },
    );
    layers.push({ role, src: dataUrl(rendered.buffer) });
  }
  return {
    width: scene.width,
    height: scene.height,
    motion: normalizeMotion(scene.motion),
    layers,
  };
}

module.exports = { createMotionPreview };
