import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { studioPosterBrand } = require("../backend/services/social-studio/tenant-branding.js");
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));

test("cada cinema tem assinatura 3D transparente e endereco proprio no Studio", async () => {
  const websites = {
    "cine-estacao-amparo": "www.cineestacaoamparo.com.br",
    "cinemax-piraju": "www.cinemaxpiraju.com.br",
    "cine-gama": "www.cinegama.com.br",
    "cinemania-cosmopolis": "www.cinemaniacosmopolis.com.br"
  };
  for (const slug of ["cine-estacao-amparo", "cinemax-piraju", "cine-gama", "cinemania-cosmopolis"]) {
    const brand = studioPosterBrand(slug);
    assert.ok(brand.signature.includes(slug));
    assert.equal(brand.website, websites[slug]);
    const image = await readFile(path.join(publicRoot, brand.signature.slice(1)));
    const metadata = await sharp(image).metadata();
    const stats = await sharp(image).stats();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.hasAlpha, true);
    assert.ok(metadata.width >= 1200 && metadata.height >= 500);
    assert.equal(stats.channels[3].min, 0);
    assert.ok(stats.channels[3].max >= 250);
  }
  assert.equal(studioPosterBrand("other-cinema"), null);
});
