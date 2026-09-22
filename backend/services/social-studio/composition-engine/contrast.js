const sharp = require("sharp");
const { loadAsset } = require("../engine/assets");
const { createCinematicArtwork } = require("./pipeline");
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (rgb) =>
  rgb.reduce(
    (sum, value, i) => sum + linear(value / 255) * [0.2126, 0.7152, 0.0722][i],
    0,
  );
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function ensureTextContrast(scene, loadImage) {
  if (!scene.elements.some((e) => e.id === "copy-contrast")) return scene;
  const scale = 180 / scene.width,
    height = Math.round(scene.height * scale),
    layers = [];
  for (const element of scene.elements.filter(
    (e) => e.type === "image" && e.effects && e.visible,
  )) {
    const source = await loadAsset(element.src, loadImage);
    if (!source) continue;
    const raster = await createCinematicArtwork(source, element);
    const left = Math.round(element.x * scale),
      top = Math.round(element.y * scale);
    const width = Math.min(
        180 - left,
        Math.max(1, Math.round(element.width * scale)),
      ),
      rh = Math.min(
        height - top,
        Math.max(1, Math.round(element.height * scale)),
      );
    if (left < 0 || top < 0 || width <= 0 || rh <= 0) continue;
    const pixels = await sharp(raster)
      .resize(width, rh)
      .ensureAlpha()
      .raw()
      .toBuffer();
    if (element.opacity !== undefined && element.opacity < 1)
      for (let i = 3; i < pixels.length; i += 4)
        pixels[i] = Math.round(pixels[i] * element.opacity);
    layers.push({
      input: pixels,
      raw: { width, height: rh, channels: 4 },
      left,
      top,
    });
  }
  const { data } = await sharp({
    create: {
      width: 180,
      height,
      channels: 3,
      background: scene.backgroundColor,
    },
  })
    .composite(layers)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  scene.elements = scene.elements.filter(
    (e) => !["copy-contrast", "footer-contrast"].includes(e.id),
  );
  const gradients = [];
  for (const text of scene.elements.filter(
    (e) => e.type === "text" && e.text?.trim(),
  )) {
    if (
      text.id === "detail" &&
      scene.elements.some((e) => e.id === "detail-band")
    )
      continue;
    const pixels = [];
    for (
      let y = Math.max(0, Math.floor(text.y * scale));
      y < Math.min(height, Math.ceil((text.y + text.height) * scale));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(text.x * scale));
        x < Math.min(180, Math.ceil((text.x + text.width) * scale));
        x++
      )
        pixels.push([
          ...data.subarray((y * 180 + x) * 3, (y * 180 + x) * 3 + 3),
        ]);
    if (!pixels.length) continue;
    const values = pixels.map(luminance).sort((a, b) => a - b);
    const low = values[Math.floor(values.length * 0.03)],
      high = values[Math.floor(values.length * 0.97)];
    const white = ratio(1, high),
      black = ratio(0.004, low);
    const dark = black >= 4.5 && black > white;
    const accent = /^#[0-9a-f]{6}$/i.test(text.fill)
      ? luminance([1, 3, 5].map((i) => parseInt(text.fill.slice(i, i + 2), 16)))
      : 1;
    const preserveAccent = !dark && accent > high && ratio(accent, high) >= 4.5;
    text.fill = dark ? "#101419" : preserveAccent ? text.fill : "#ffffff";
    const foreground = dark ? 0.006 : preserveAccent ? accent : 1;
    let opacity = 0;
    const worst = () =>
      pixels
        .map((rgb) =>
          ratio(foreground, luminance(rgb.map((v) => v * (1 - opacity)))),
        )
        .sort((a, b) => a - b)[Math.floor(pixels.length * 0.03)];
    if (!dark) while (opacity < 0.86 && worst() < 4.5) opacity += 0.04;
    text.contrastRatio = Number(worst().toFixed(2));
    text.shadowBlur = dark ? 0 : 4;
    text.shadowColor = "rgba(0,0,0,0.45)";
    if (opacity > 0) {
      const padX = scene.width * 0.055,
        padY = scene.height * 0.04;
      const x = Math.max(0, text.x - padX),
        y = Math.max(0, text.y - padY);
      const h = Math.min(scene.height - y, text.height + padY * 2);
      const width = Math.min(scene.width - x, text.width + padX * 2);
      gradients.push({
        id: `contrast-${text.id}`,
        name: `Contraste: ${text.name}`,
        role: "contrast",
        type: "image",
        src: scene.elements.find((e) => e.id === "background-blur")?.src || "",
        fit: "cover",
        x,
        y,
        width,
        height: h,
        opacity,
        visible: true,
        locked: true,
        effects: {
          layer: "contrast",
          featherX: Math.min(0.45, padX / width),
          featherY: Math.min(0.45, padY / h),
        },
      });
    }
  }
  const textIndex = scene.elements.findIndex((e) => e.type === "text");
  scene.elements.splice(Math.max(0, textIndex), 0, ...gradients);
  return scene;
}
module.exports = { ensureTextContrast, luminance };
