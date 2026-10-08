const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function maskAlpha(x, y, mask, blend) {
  if (!blend || mask === "none") return 1;
  const edge = 0.015 + (blend / 100) * 0.2;
  const left = smooth(x / edge),
    right = smooth((1 - x) / edge);
  const top = smooth(y / edge),
    bottom = smooth((1 - y) / edge);
  if (mask === "fade-bottom") return bottom;
  if (mask === "fade-top") return top;
  if (mask === "fade-left") return left;
  if (mask === "fade-right") return right;
  if (mask === "radial")
    return smooth(
      (1 - Math.hypot((x - 0.5) * 1.42, (y - 0.5) * 1.42)) / (edge * 1.8),
    );
  if (mask === "cinematic-bottom")
    return left * right * top * smooth((1 - y) / (edge * 1.7));
  return left * right * top * bottom;
}

function alphaMask(width, height, mask, blend) {
  const data = require('./procedural-cache').cachedPixels(JSON.stringify(['mask',width,height,mask,blend]),()=>{
  const pixels = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels[(y * width + x) * 4 + 3] = Math.round(
        255 *
          maskAlpha(
            x / Math.max(1, width - 1),
            y / Math.max(1, height - 1),
            mask,
            blend,
          ),
      );
  return pixels;
  });
  return { input: data, raw: { width, height, channels: 4 }, blend: "dest-in" };
}

module.exports = { alphaMask, maskAlpha, smooth };
