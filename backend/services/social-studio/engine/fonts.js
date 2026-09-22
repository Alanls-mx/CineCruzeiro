const fs = require("fs");
const path = require("path");

const FONT_DIR = path.join(__dirname, "..", "..", "..", "..", "public", "fonts", "social-studio");
let cachedFonts = null;

function readFont(filename) {
  return fs.readFileSync(path.join(FONT_DIR, filename));
}

function socialStudioFonts() {
  if (cachedFonts) return cachedFonts;
  cachedFonts = Object.freeze([
    { name: "Social Display", data: readFont("BarlowCondensed-Black.ttf"), weight: 900, style: "normal" },
    { name: "Social Text", data: readFont("BarlowCondensed-SemiBold.ttf"), weight: 600, style: "normal" }
  ]);
  return cachedFonts;
}

module.exports = { FONT_DIR, socialStudioFonts };
