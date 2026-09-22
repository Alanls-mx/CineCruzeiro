const sharp = require("sharp");
const { renderSocialPostV2 } = require("../engine/renderer");
const { STYLES } = require("./config");

async function generateVariations(input, context, options = {}) {
  const styles = [
    "hero-left",
    "full-bleed",
    "typography-dominant",
    "editorial",
    "hero-right",
    "split",
  ];
  const variations = [],
    rejected = [];
  for (const [index, style] of styles.entries()) {
    if (variations.length === 4) break;
    const draft = {
      ...input,
      style,
      automaticStyle: false,
      artDirection: {
        ...input.artDirection,
        enabled: true,
        seed: (Number(input.artDirection?.seed) || 0) + index,
        emphasis:
          style === "typography-dominant"
            ? "date"
            : input.artDirection?.emphasis || "automatic",
      },
    };
    const rendered = await renderSocialPostV2(draft, context, options);
    if (!rendered.quality.accepted) {
      rejected.push({ style, quality: rendered.quality });
      continue;
    }
    const thumb = await sharp(rendered.buffer)
      .resize({ width: 400 })
      .jpeg({ quality: 85 })
      .toBuffer();
    const { entities, ...payload } = rendered.draft;
    variations.push({
      id: style,
      name: STYLES.find((s) => s.id === style)?.name || style,
      draft: payload,
      quality: rendered.quality,
      image: `data:image/jpeg;base64,${thumb.toString("base64")}`,
    });
  }
  return {
    variations,
    rejectedCount: rejected.length,
    notices:
      variations.length < 3
        ? [
            "Algumas composições não passaram na revisão automática. Reduza o texto ou selecione outra imagem para obter mais opções.",
          ]
        : [],
  };
}
module.exports = { generateVariations };
