import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const {
  normalizeEffects,
  normalizeComposition,
  normalizeMotion,
  MASKS,
} = require("../backend/services/social-studio/composition-engine/config");
const {
  maskAlpha,
} = require("../backend/services/social-studio/composition-engine/masks");
const {
  createCinematicArtwork,
  compositionCacheStats,
  normalizeRequest,
} = require("../backend/services/social-studio/composition-engine/pipeline");
const {
  createMotionPreview,
} = require("../backend/services/social-studio/composition-engine/motion");
const engine = require("../backend/services/socialStudioEngineService");
const {
  buildEditableScene,
  LAYOUTS,
} = require("../backend/services/social-studio/scene/factory");

const palette = {
  dominantColor: "#316036",
  accentColor: "#9eaf5b",
  secondaryColor: "#162817",
};
const brand = {
  name: "Cinema",
  posterWebsite: "www.cinema.example",
  primaryColor: "#163421",
  accentColor: "#fafafa",
};
const solid = (color, width = 80, height = 120) =>
  sharp({ create: { width, height, channels: 4, background: color } })
    .png()
    .toBuffer();

test("presets automáticos acompanham o gênero e respeitam substituições", () => {
  assert.equal(normalizeComposition({}, "family").resolvedPreset, "animation");
  assert.equal(normalizeComposition({}, "horror").saturation, 0.72);
  const fx = normalizeComposition(
    { preset: "drama", look: "vibrant", adjustments: { blend: 42 } },
    "action",
  );
  assert.equal(fx.resolvedPreset, "drama");
  assert.equal(fx.saturation, 1.25);
  assert.equal(fx.blend, 42);
  assert.deepEqual(normalizeComposition(fx, "action"), fx);
  assert.equal(normalizeComposition({ enabled: false }).enabled, false);
});

test("efeitos limitam entradas inválidas e dimensões de processamento", () => {
  const fx = normalizeEffects({
    blur: 999,
    blend: Infinity,
    color: "url(bad)",
    layer: "unknown",
    saturation: -5,
  });
  assert.equal(fx.blur, 80);
  assert.equal(fx.blend, 0);
  assert.equal(fx.saturation, 0);
  assert.equal(fx.layer, "image");
  assert.equal(fx.color, "#609edb");
  assert.equal(normalizeRequest({ width: 1e9, height: 1e9 }).width, 2160);
  assert.equal(normalizeRequest({ width: 1e9, height: 1e9 }).height, 3840);
  assert.deepEqual(normalizeMotion({ duration: 1000, easing: "bounce" }), {
    animationPreset: "slow-zoom",
    duration: 8,
    easing: "ease-in-out",
  });
});

test("máscaras preservam o centro e dissolvem apenas as bordas selecionadas", () => {
  for (const mask of MASKS)
    assert.equal(maskAlpha(0.5, 0.5, mask, 70), 1, mask);
  for (const mask of ["fade-all", "radial", "cinematic-bottom"])
    assert.equal(maskAlpha(0, 0, mask, 70), 0);
  assert.equal(maskAlpha(0.5, 1, "fade-bottom", 80), 0);
  assert.equal(maskAlpha(0.5, 0, "fade-bottom", 80), 1);
  assert.equal(maskAlpha(0, 0.5, "fade-right", 80), 1);
  assert.equal(maskAlpha(1, 0.5, "fade-right", 80), 0);
  assert.equal(maskAlpha(0, 0, "fade-all", 0), 1);
});

test("rasterização preserva RGB central e aplica alfa nas bordas reais do poster", async () => {
  const source = await solid("#fa6432");
  const result = await createCinematicArtwork(source, {
    width: 200,
    height: 200,
    fit: "contain",
    effects: { blend: 75, mask: "fade-all" },
  });
  const { data, info } = await sharp(result)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [
    ...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4),
  ];
  assert.deepEqual(pixel(100, 100), [250, 100, 50, 255]);
  assert.equal(pixel(0, 100)[3], 0);
  assert.equal(pixel(33, 100)[3], 0);
  assert.ok(pixel(40, 100)[3] > 0 && pixel(40, 100)[3] < 255);
});

test("cache deduplica pedidos concorrentes e reutiliza exatamente os mesmos pixels", async () => {
  const source = await solid("#ab3462");
  const request = {
    width: 160,
    height: 200,
    effects: { layer: "background", blur: 30, scale: 1.3 },
  };
  const before = compositionCacheStats();
  const [a, b] = await Promise.all([
    createCinematicArtwork(source, request),
    createCinematicArtwork(source, request),
  ]);
  const c = await createCinematicArtwork(source, request);
  assert.ok(a.equals(b) && a.equals(c));
  assert.equal(compositionCacheStats().processed - before.processed, 1);
  assert.ok(compositionCacheStats().hits - before.hits >= 2);
  assert.ok(compositionCacheStats().bytes <= 64 * 1024 * 1024);
});

test("foco muda o recorte cover sem esticar a imagem", async () => {
  const red = await solid("#ff0000", 100, 100),
    blue = await solid("#0000ff", 100, 100);
  const source = await sharp({
    create: { width: 200, height: 100, channels: 4, background: "#000000" },
  })
    .composite([
      { input: red, left: 0, top: 0 },
      { input: blue, left: 100, top: 0 },
    ])
    .png()
    .toBuffer();
  const a = await createCinematicArtwork(source, {
    width: 100,
    height: 100,
    focusX: 0,
    effects: {},
  });
  const b = await createCinematicArtwork(source, {
    width: 100,
    height: 100,
    focusX: 100,
    effects: {},
  });
  assert.equal((await sharp(a).stats()).channels[0].mean, 255);
  assert.equal((await sharp(b).stats()).channels[2].mean, 255);
});

test("camadas cinematográficas e textos ficam dentro da tela em todos os layouts", () => {
  for (const [formatId, height] of [
    ["square", 1080],
    ["feed_portrait", 1350],
    ["story", 1920],
  ])
    for (const style of Object.keys(LAYOUTS)) {
      const scene = buildEditableScene({
        draft: {
          style,
          templateId: "movie-premiere",
          title: "Filme de teste",
          date: "22 DE OUTUBRO",
        },
        format: { id: formatId, width: 1080, height },
        brand,
        palette,
        sourceUrl: "asset://test",
      });
      const bg = scene.elements.find((e) => e.id === "background-blur");
      assert.deepEqual([bg.x, bg.y, bg.width, bg.height], [0, 0, 1080, height]);
      assert.ok(
        scene.elements.find((e) => e.id === "artwork").effects.blend > 0,
      );
      for (const e of scene.elements) {
        assert.ok(
          e.x >= 0 &&
            e.y >= 0 &&
            e.x + e.width <= 1081 &&
            e.y + e.height <= height + 1,
          `${style}/${formatId}/${e.id}`,
        );
        if (e.type === "text")
          assert.ok(
            e.text.split("\n").length * e.fontSize * e.lineHeight <=
              e.height + 1,
          );
      }
    }
});

test("fundo usa backdrop; sem backdrop duplica poster; full bleed exige resolução", async () => {
  const poster = await solid("#d09856");
  const backdrop = await solid("#aabcce", 1200, 700);
  const context = {
    brand,
    movies: [
      {
        id: "one",
        title: "Teste",
        releaseDate: "2026-10-22",
        genres: ["Drama"],
        posterUrl: "asset://cmp-poster",
        backdropUrl: "asset://cmp-backdrop",
      },
    ],
  };
  const loadImage = async (url) =>
    url === "asset://cmp-poster"
      ? poster
      : url === "asset://cmp-backdrop"
        ? backdrop
        : null;
  let result = await engine.renderSocialPost(
    { movieId: "one", style: "full-bleed" },
    context,
    { loadImage },
  );
  assert.equal(
    result.scene.elements.find((e) => e.id === "background-blur").src,
    "asset://cmp-backdrop",
  );
  assert.equal(
    result.scene.elements.find((e) => e.id === "artwork").visible,
    false,
  );
  context.movies[0].backdropUrl = "";
  result = await engine.renderSocialPost(
    { movieId: "one", style: "full-bleed" },
    context,
    { loadImage },
  );
  assert.equal(
    result.scene.elements.find((e) => e.id === "background-blur").src,
    "asset://cmp-poster",
  );
  assert.equal(
    result.scene.elements.find((e) => e.id === "artwork").visible,
    true,
  );
  assert.ok(result.notices.some((n) => n.code === "BACKDROP_FALLBACK"));
  const record = engine.createHistoryRecord(result, {}, context);
  assert.equal(record.payload.composition.resolvedPreset, "drama");
  assert.equal(record.payload.motion.duration, 8);
  const exported = await engine.renderSocialScene(result.scene, { loadImage });
  assert.ok(
    result.buffer.equals(exported.buffer),
    "preview and saved scene export must be byte-equivalent",
  );
});

test("prévia de movimento reutiliza camadas raster e conserva dimensões", async () => {
  const scene = buildEditableScene({
    draft: {
      style: "immersive",
      templateId: "movie-premiere",
      title: "Motion",
      motion: { duration: 5, animationPreset: "pan-zoom" },
    },
    format: { id: "square", width: 320, height: 320 },
    brand,
    palette,
  });
  const preview = await createMotionPreview(scene, {
    loadImage: async () => null,
  });
  assert.ok(preview.motionSpec.duration >= 5);
  assert.equal(preview.motionSpec.tracks[0].id, scene.elements.find(element=>element.visible!==false).id);
  assert.equal(preview.contentType, 'video/mp4');
  assert.equal(Buffer.from(preview.src.split(',')[1], 'base64').toString('ascii',4,8),'ftyp');
  assert.deepEqual([preview.width,preview.height],[320,320]);
});
