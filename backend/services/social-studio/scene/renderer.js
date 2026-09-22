const sharp = require("sharp");
const { dataUrl, loadAsset } = require("../engine/assets");
const { socialStudioFonts } = require("../engine/fonts");
const { normalizeScene } = require("./schema");
const { createCinematicArtwork } = require("../composition-engine/pipeline");

let satoriPromise = null;

async function satoriRenderer() {
  if (!satoriPromise) satoriPromise = import("satori").then((module) => module.default || module);
  return satoriPromise;
}

function node(type, props = {}, children = []) {
  const list = Array.isArray(children) ? children : [children];
  return { type, props: { ...props, children: list } };
}

function elementStyle(element, relative = false) {
  const style = {
    position: relative ? "relative" : "absolute",
    width: element.width,
    height: element.height,
    opacity: element.opacity,
    display: element.visible === false ? "none" : "flex",
    transformOrigin: "top left",
    overflow: element.type === "group" ? "visible" : "hidden"
  };
  if (!relative) {
    style.left = element.x;
    style.top = element.y;
  }
  if (element.rotation) style.transform = `rotate(${element.rotation}deg)`;
  return style;
}

function gradientCss(element) {
  const angle = { bottom: "180deg", top: "0deg", left: "270deg", right: "90deg" }[element.direction] || "180deg";
  return `linear-gradient(${angle}, ${element.stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(", ")})`;
}

async function imageData(element, loadImage) {
  const buffer = await loadAsset(element.src, loadImage);
  if (!buffer) return "";
  if (element.effects) return dataUrl(await createCinematicArtwork(buffer, element));
  let pipeline = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  if (element.crop) {
    const metadata = await pipeline.metadata();
    const width = Math.max(1, Math.min(Math.round(element.crop.width), Number(metadata.width || element.crop.width)));
    const height = Math.max(1, Math.min(Math.round(element.crop.height), Number(metadata.height || element.crop.height)));
    const left = Math.max(0, Math.min(Math.round(element.crop.x), Math.max(0, Number(metadata.width || width) - width)));
    const top = Math.max(0, Math.min(Math.round(element.crop.y), Math.max(0, Number(metadata.height || height) - height)));
    pipeline = pipeline.extract({ left, top, width, height });
  }
  return dataUrl(await pipeline.png({ compressionLevel: 7, adaptiveFiltering: true }).toBuffer());
}

async function renderElement(element, loadImage, relative = false) {
  if (element.visible === false) return null;
  const style = elementStyle(element, relative);
  if (element.type === "text") {
    const textStyle = {
        ...style,
        color: element.fill,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        lineHeight: element.lineHeight,
        letterSpacing: element.letterSpacing,
        textAlign: element.align,
        textTransform: element.uppercase ? "uppercase" : "none",
        alignItems: "center",
        justifyContent: element.align === "left" ? "flex-start" : element.align === "right" ? "flex-end" : "center",
        whiteSpace: "pre-wrap"
      };
    if (element.shadowBlur) textStyle.textShadow = `0 0 ${element.shadowBlur}px ${element.shadowColor}`;
    return node("div", { style: textStyle }, element.text);
  }
  if (element.type === "image") {
    const src = await imageData(element, loadImage);
    if (!src) return null;
    return node("img", {
      src,
      style: {
        ...style,
        objectFit: element.effects ? "fill" : element.fit,
        objectPosition: `${element.focusX}% ${element.focusY}%`
      }
    });
  }
  if (element.type === "shape") {
    const shapeStyle = {
        ...style,
        background: element.fill,
        borderRadius: element.radius
      };
    if (element.strokeWidth) shapeStyle.border = `${element.strokeWidth}px solid ${element.stroke}`;
    return node("div", { style: shapeStyle });
  }
  if (element.type === "gradient") {
    return node("div", { style: { ...style, backgroundImage: gradientCss(element) } });
  }
  const children = (await Promise.all(element.children.map((child) => renderElement(child, loadImage)))).filter(Boolean);
  return node("div", { style }, children);
}

async function renderSocialScene(input = {}, options = {}) {
  const scene = normalizeScene(input);
  const loadImage = typeof options.loadImage === "function" ? options.loadImage : async () => null;
  const children = (await Promise.all(scene.elements.map((element) => renderElement(element, loadImage)))).filter(Boolean);
  const tree = node("div", {
    style: {
      position: "relative",
      display: "flex",
      width: scene.width,
      height: scene.height,
      overflow: "hidden",
      background: options.transparent ? "rgba(0,0,0,0)" : scene.backgroundColor
    }
  }, children);
  const satori = await satoriRenderer();
  const svg = await satori(tree, {
    width: scene.width,
    height: scene.height,
    fonts: socialStudioFonts()
  });
  const outputType = options.outputType === "jpg" ? "jpg" : "png";
  const pipeline = sharp(Buffer.from(svg), { failOn: "error", density: 72 });
  const buffer = outputType === "jpg"
    ? await pipeline.flatten({ background: scene.backgroundColor }).jpeg({ quality: 94, chromaSubsampling: "4:4:4", progressive: true }).toBuffer()
    : await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
  return {
    buffer,
    scene,
    outputType,
    contentType: outputType === "jpg" ? "image/jpeg" : "image/png",
    extension: outputType === "jpg" ? ".jpg" : ".png"
  };
}

module.exports = { renderSocialScene };
