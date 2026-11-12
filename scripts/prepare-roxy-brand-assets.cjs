const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "public", "images", "cine-roxy");
  const branding = path.join(root, "branding", "cine-roxy");
  const destinations = [
    path.join(branding, "public", "images"),
    path.join(branding, "backend-public", "images"),
  ];
  const logoSvg = fs.readFileSync(path.join(source, "logo-horizontal.svg"));
  const logo = await sharp(logoSvg, { density: 192 }).resize({ width: 1140 }).png().toBuffer();
  for (const destination of destinations) {
    fs.mkdirSync(destination, { recursive: true });
    await sharp(logo).webp({ quality: 92 }).toFile(path.join(destination, "logo-display.webp"));
    await sharp(logo).webp({ quality: 92 }).toFile(path.join(destination, "logo-header-compact.webp"));
    await sharp(logo).flatten({ background: "#170b0c" }).jpeg({ quality: 92 }).toFile(path.join(destination, "logo-pdf.jpg"));
  }
  const backendImages = path.join(branding, "backend-public", "images", "cine-roxy");
  fs.mkdirSync(backendImages, { recursive: true });
  for (const file of ["auditorio.jpg", "logo-horizontal.svg", "mark.svg"]) {
    fs.copyFileSync(path.join(source, file), path.join(backendImages, file));
  }
  console.log("Identidade do Cine Roxy preparada.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
