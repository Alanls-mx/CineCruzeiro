const crypto = require("crypto");
const sharp = require("sharp");
const { normalizeEffects } = require("./config");
const { alphaMask, smooth } = require("./masks");

const cache = new Map(),
  pending = new Map(),
  waiters = [];
const MAX_BYTES = 64 * 1024 * 1024,
  TTL = 20 * 60 * 1000;
let bytes = 0,
  active = 0,
  hits = 0,
  processed = 0;
const numeric = (v, d, lo, hi) =>
  Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d;
function normalizeRequest(element = {}) {
  const crop = element.crop;
  return {
    width: Math.round(numeric(element.width, 1080, 8, 2160)),
    height: Math.round(numeric(element.height, 1350, 8, 3840)),
    fit: element.fit === "contain" ? "contain" : "cover",
    focusX: numeric(element.focusX, 50, 0, 100),
    focusY: numeric(element.focusY, 50, 0, 100),
    crop:
      crop && Number(crop.width) > 0 && Number(crop.height) > 0
        ? {
            x: numeric(crop.x, 0, 0, 40000000),
            y: numeric(crop.y, 0, 0, 40000000),
            width: numeric(crop.width, 1, 1, 40000000),
            height: numeric(crop.height, 1, 1, 40000000),
          }
        : null,
    effects: normalizeEffects(element.effects),
  };
}

async function limited(job) {
  if (active >= 2) {
    if (waiters.length >= 100)
      throw new Error(
        "O Studio está processando outras artes. Tente novamente em instantes.",
      );
    await new Promise((resolve) => waiters.push(resolve));
  } else active++;
  try {
    return await job();
  } finally {
    if (waiters.length) waiters.shift()();
    else active--;
  }
}

function rgbaLayer(width, height, fx) {
  const data = Buffer.alloc(width * height * 4);
  const rgb = [1, 3, 5].map((i) => parseInt(fx.color.slice(i, i + 2), 16));
  let seed = 195936478;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        nx = x / width,
        ny = y / height;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = seed / 4294967296;
      let alpha = 0,
        color = rgb;
      if (fx.layer === "wash") alpha = fx.colorWash / 100;
      if (fx.layer === "contrast") {
        color = [0, 0, 0];
        alpha =
          smooth(nx / fx.featherX) *
          smooth((1 - nx) / fx.featherX) *
          smooth(ny / fx.featherY) *
          smooth((1 - ny) / fx.featherY);
      }
      if (fx.layer === "glow")
        alpha =
          ((Math.exp(-3 * ((nx - 0.5) ** 2 / 0.22 + (ny - 0.46) ** 2 / 0.28)) *
            smooth(Math.min(nx, 1 - nx, ny, 1 - ny) / 0.18) *
            fx.glow) /
            100) *
          0.65;
      if (fx.layer === "vignette") {
        alpha =
          (smooth(
            (Math.hypot((nx - 0.5) * 1.4, (ny - 0.47) * 1.4) - 0.22) / 0.65,
          ) *
            fx.vignette) /
          100;
        color = [0, 0, 0];
      }
      if (fx.layer === "atmosphere") {
        if (fx.overlay === "fog")
          alpha =
            Math.max(0, Math.sin(nx * 7 + ny * 3) * Math.cos(ny * 8 - nx * 2)) *
            0.045;
        if (fx.overlay === "light-leak")
          alpha =
            Math.pow(1 - nx, 3) * Math.max(0, 1 - Math.abs(ny - 0.45)) * 0.12;
        if (fx.overlay === "gradient-light")
          alpha = Math.max(0, 1 - Math.abs(nx + ny * 0.7 - 0.35) * 2) * 0.09;
        if (fx.overlay === "dust" && random > 0.9995) alpha = 0.12;
        if (fx.grain) {
          alpha += (random * fx.grain) / 100;
          color = random < 0.5 ? [0, 0, 0] : [255, 255, 255];
        }
      }
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  return sharp(data, { raw: { width, height, channels: 4 } });
}

async function processArtwork(source, request) {
  const { width, height, effects: fx } = request;
  if (["wash", "vignette", "atmosphere", "glow", "contrast"].includes(fx.layer))
    return rgbaLayer(width, height, fx).png().toBuffer();
  let original = await sharp(source, {
    failOn: "error",
    limitInputPixels: 40000000,
  })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  if (request.crop) {
    const cw = Math.min(original.info.width, Math.round(request.crop.width)),
      ch = Math.min(original.info.height, Math.round(request.crop.height));
    original = await sharp(original.data)
      .extract({
        left: Math.min(original.info.width - cw, Math.round(request.crop.x)),
        top: Math.min(original.info.height - ch, Math.round(request.crop.y)),
        width: cw,
        height: ch,
      })
      .toBuffer({ resolveWithObject: true });
  }
  if (fx.cropLeft || fx.cropRight || fx.cropTop || fx.cropBottom) {
    const ow = original.info.width,
      oh = original.info.height;
    const left = Math.floor((ow * fx.cropLeft) / 100),
      top = Math.floor((oh * fx.cropTop) / 100);
    original = await sharp(original.data)
      .extract({
        left,
        top,
        width: Math.max(1, ow - left - Math.floor((ow * fx.cropRight) / 100)),
        height: Math.max(1, oh - top - Math.floor((oh * fx.cropBottom) / 100)),
      })
      .toBuffer({ resolveWithObject: true });
  }
  const cover = fx.layer === "background" || request.fit === "cover";
  const scale = cover
    ? Math.max(width / original.info.width, height / original.info.height) *
      Math.max(1, fx.scale)
    : Math.min(width / original.info.width, height / original.info.height) *
      fx.scale;
  const rw = Math.max(1, Math.round(original.info.width * scale)),
    rh = Math.max(1, Math.round(original.info.height * scale));
  // Sharp's cover resize avoids allocating very wide/tall intermediate rasters.
  let image = sharp(original.data);
  if (cover) {
    const cropWidth = Math.min(
        original.info.width,
        Math.max(1, Math.round(width / scale)),
      ),
      cropHeight = Math.min(
        original.info.height,
        Math.max(1, Math.round(height / scale)),
      );
    image = image
      .extract({
        left: Math.round(
          ((original.info.width - cropWidth) * request.focusX) / 100,
        ),
        top: Math.round(
          ((original.info.height - cropHeight) * request.focusY) / 100,
        ),
        width: cropWidth,
        height: cropHeight,
      })
      .resize(width, height);
  } else image = image.resize(rw, rh, { fit: "fill" });
  image = image.ensureAlpha();
  image = image
    .modulate({ brightness: fx.brightness, saturation: fx.saturation })
    .linear(fx.contrast, 128 * (1 - fx.contrast));
  if (fx.blur >= 0.3) image = image.blur(fx.blur);
  let raster = await image.png().toBuffer({ resolveWithObject: true });
  if (raster.info.width > width || raster.info.height > height)
    raster = await sharp(raster.data)
      .extract({
        left: Math.round(
          (Math.max(0, raster.info.width - width) * request.focusX) / 100,
        ),
        top: Math.round(
          (Math.max(0, raster.info.height - height) * request.focusY) / 100,
        ),
        width: Math.min(width, raster.info.width),
        height: Math.min(height, raster.info.height),
      })
      .png()
      .toBuffer({ resolveWithObject: true });
  if (fx.blend && fx.mask !== "none")
    raster = await sharp(raster.data)
      .composite([
        alphaMask(raster.info.width, raster.info.height, fx.mask, fx.blend),
      ])
      .png()
      .toBuffer({ resolveWithObject: true });
  const left = Math.round(((width - raster.info.width) * request.focusX) / 100),
    top = Math.round(((height - raster.info.height) * request.focusY) / 100);
  let fitted = await sharp({
    create: { width, height, channels: 4, background: "#00000000" },
  })
    .composite([{ input: raster.data, left, top }])
    .png()
    .toBuffer();
  if (["ambient-shadow", "contact-shadow"].includes(fx.layer)) {
    const extracted = await sharp(fitted).extractChannel(3).png().toBuffer();
    const alpha = await sharp(extracted)
      .blur(fx.layer === "ambient-shadow" ? 40 : 12)
      .linear(fx.shadow / (fx.layer === "ambient-shadow" ? 100 : 170), 0)
      .png()
      .toBuffer();
    const shadow = await sharp({
      create: { width, height, channels: 3, background: "#000000" },
    })
      .joinChannel(alpha)
      .png()
      .toBuffer();
    const dx = Math.min(width - 1, Math.round(width * 0.018)),
      dy = Math.min(
        height - 1,
        Math.round(height * (fx.layer === "ambient-shadow" ? 0.024 : 0.012)),
      );
    return sharp({
      create: { width, height, channels: 4, background: "#00000000" },
    })
      .composite([
        {
          input: await sharp(shadow)
            .extract({
              left: 0,
              top: 0,
              width: width - dx,
              height: height - dy,
            })
            .toBuffer(),
          left: dx,
          top: dy,
        },
      ])
      .png()
      .toBuffer();
  }
  if (fx.layer === "glow" || fx.glow || fx.shadow) {
    const extracted = await sharp(fitted).extractChannel(3).png().toBuffer();
    const alpha = await sharp(extracted)
      .blur(fx.shadow > fx.glow ? 35 : 80)
      .linear(
        Math.max(fx.glow, fx.shadow) / (fx.shadow > fx.glow ? 100 : 350),
        0,
      )
      .toBuffer();
    const light = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: fx.shadow > fx.glow ? "#000000" : fx.color,
      },
    })
      .joinChannel(alpha)
      .png()
      .toBuffer();
    fitted =
      fx.layer === "glow"
        ? light
        : await sharp(light)
            .composite([{ input: fitted }])
            .png()
            .toBuffer();
  }
  if (fx.vignette || fx.colorWash || fx.grain || fx.overlay !== "none") {
    const layers = [];
    if (fx.colorWash)
      layers.push({
        input: await rgbaLayer(width, height, { ...fx, layer: "wash" })
          .png()
          .toBuffer(),
      });
    if (fx.vignette)
      layers.push({
        input: await rgbaLayer(width, height, { ...fx, layer: "vignette" })
          .png()
          .toBuffer(),
      });
    if (fx.grain || fx.overlay !== "none")
      layers.push({
        input: await rgbaLayer(width, height, { ...fx, layer: "atmosphere" })
          .png()
          .toBuffer(),
      });
    fitted = await sharp(fitted).composite(layers).png().toBuffer();
  }
  return fitted;
}

async function createCinematicArtwork(source, element) {
  const request = normalizeRequest(element);
  const key = crypto
    .createHash("sha256")
    .update(source)
    .update(JSON.stringify(request))
    .digest("hex");
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) {
    hits++;
    cache.delete(key);
    cache.set(key, existing);
    return existing.buffer;
  }
  if (existing) {
    bytes -= existing.buffer.length;
    cache.delete(key);
  }
  if (pending.has(key)) {
    hits++;
    return pending.get(key);
  }
  const promise = limited(async () => {
    const buffer = await processArtwork(source, request);
    processed++;
    cache.set(key, { buffer, expires: Date.now() + TTL });
    bytes += buffer.length;
    while (bytes > MAX_BYTES || cache.size > 40) {
      const oldest = cache.keys().next().value;
      bytes -= cache.get(oldest).buffer.length;
      cache.delete(oldest);
    }
    return buffer;
  });
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}

module.exports = {
  createCinematicArtwork,
  normalizeRequest,
  compositionCacheStats: () => ({
    entries: cache.size,
    bytes,
    active,
    pending: pending.size,
    hits,
    processed,
  }),
};
