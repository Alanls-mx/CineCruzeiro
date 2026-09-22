import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const engine = require("../backend/services/socialStudioEngineService");
const {
  normalizeDirection,
} = require("../backend/services/social-studio/composition-engine/config");
const {
  DIRECTIONS,
  analyzeArtwork,
  directionPlan,
} = require("../backend/services/social-studio/composition-engine/direction");
const {
  buildEditableScene,
} = require("../backend/services/social-studio/scene/factory");
const {
  scoreComposition,
} = require("../backend/services/social-studio/composition-engine/score");
const {
  createCinematicArtwork,
} = require("../backend/services/social-studio/composition-engine/pipeline");
const {
  ensureTextContrast,
} = require("../backend/services/social-studio/composition-engine/contrast");
const {
  generateVariations,
} = require("../backend/services/social-studio/composition-engine/variations");
const brand = {
  name: "Cinema",
  posterWebsite: "www.cinema.example",
  logoUrl: "asset://direction-logo",
  primaryColor: "#184526",
  accentColor: "#eeeedd",
};
const palette = {
  dominantColor: "#385234",
  accentColor: "#c8dc70",
  secondaryColor: "#405041",
};
const solid = (color, width = 100, height = 150) =>
  sharp({ create: { width, height, channels: 4, background: color } })
    .png()
    .toBuffer();
const draft = (style = "hero-left", artDirection = {}) => ({
  style,
  templateId: "movie-premiere",
  movieId: "test",
  title: "A grande aventura",
  date: "22 DE OUTUBRO",
  subtitle: "ESTREIA",
  cta: "CONFIRA AS SESSÕES",
  composition: { enabled: true },
  artDirection: normalizeDirection(artDirection),
});
const build = (
  d,
  format = { id: "feed_portrait", width: 1080, height: 1350 },
) =>
  buildEditableScene({
    draft: d,
    format,
    brand,
    palette,
    sourceUrl: "asset://direction-poster",
    backgroundUrl: "asset://direction-background",
    logoUrl: "asset://direction-logo",
  });

test("direção normaliza parâmetros e persiste enquadramentos independentes", () => {
  const normalized = normalizeDirection({
    background: { focusX: 12, scale: 1.45, cropLeft: 10 },
    hero: { focusX: 85, scale: 0.9, cropTop: 12 },
    seed: 1e8,
    grid: "golden",
    heroMode: "floating",
  });
  assert.equal(normalized.seed, 9999);
  assert.equal(normalized.background.focusX, 12);
  assert.equal(normalized.hero.focusX, 85);
  assert.deepEqual(normalizeDirection(normalized), normalized);
  const d = engine.normalizeDraft({ ...draft(), artDirection: normalized });
  const record = engine.createHistoryRecord(
    { draft: d, format: { id: "square" }, extension: ".png" },
    {},
    {},
  );
  assert.deepEqual(record.payload.artDirection, normalized);
  const scene = build(d),
    bg = scene.elements.find((e) => e.id === "background-blur"),
    hero = scene.elements.find((e) => e.id === "artwork");
  assert.notEqual(bg.focusX, hero.focusX);
  assert.equal(bg.effects.scale, 1.45);
  assert.equal(hero.effects.scale, 0.9);
  assert.equal(bg.effects.cropLeft, 10);
  assert.equal(hero.effects.cropTop, 12);
});

test("camadas de profundidade respeitam a ordem e controles opcionais", () => {
  const scene = build(
    draft("hero-left", { secondary: true, foreground: "fog" }),
  );
  const ids = scene.elements.map((e) => e.id);
  const order = [
    "background-blur",
    "background-wash",
    "atmosphere",
    "secondary-artwork",
    "ambient-shadow",
    "contact-shadow",
    "poster-glow",
    "artwork",
    "foreground-atmosphere",
    "vignette",
    "title",
    "logo",
  ];
  for (let i = 1; i < order.length; i++)
    assert.ok(ids.indexOf(order[i]) > ids.indexOf(order[i - 1]), order[i]);
  assert.ok(!build(draft()).elements.some((e) => e.id === "secondary-artwork"));
});

test("modos do hero têm máscaras e profundidade distintas", () => {
  const effects = new Set();
  for (const mode of [
    "rectangle",
    "soft-rectangle",
    "edge-dissolve",
    "full-blend",
    "floating",
  ]) {
    const scene = build(draft("hero-left", { heroMode: mode })),
      hero = scene.elements.find((e) => e.id === "artwork");
    effects.add(JSON.stringify([hero.effects.mask, hero.effects.blend]));
    if (mode === "rectangle") assert.equal(hero.effects.blend, 0);
    if (mode === "full-blend") assert.equal(hero.effects.blend, 95);
  }
  assert.equal(effects.size, 5);
});

test("análise identifica área lisa sem afirmar reconhecimento semântico", async () => {
  const data = Buffer.alloc(120 * 120 * 3);
  for (let y = 0; y < 120; y++)
    for (let x = 0; x < 120; x++) {
      const value = x < 60 ? 30 : (x + y) % 2 ? 255 : 0;
      data.fill(value, (y * 120 + x) * 3, (y * 120 + x) * 3 + 3);
    }
  const image = await sharp(data, {
    raw: { width: 120, height: 120, channels: 3 },
  })
    .png()
    .toBuffer();
  const result = await analyzeArtwork(image);
  assert.equal(result.quietest, "left");
  assert.equal(result.method, "luminance-edge-density");
  assert.ok(
    result.zones[0].complexity <
      result.zones.find((z) => z.id === "right").complexity,
  );
});

test("layouts diferentes não mudam só cores; grid e seed são determinísticos", () => {
  const layouts = new Set();
  for (const style of Object.keys(DIRECTIONS)) {
    const scene = build(draft(style));
    layouts.add(
      JSON.stringify(
        scene.elements
          .filter((e) =>
            ["title", "detail", "cta", "logo", "artwork"].includes(e.id),
          )
          .map((e) => [e.id, e.x, e.y, e.width, e.height]),
      ),
    );
  }
  assert.equal(layouts.size, Object.keys(DIRECTIONS).length);
  const a = directionPlan(draft("hero-left", { seed: 123, grid: "40-60" })),
    b = directionPlan(draft("hero-left", { seed: 123, grid: "40-60" }));
  assert.deepEqual(a, b);
  assert.notDeepEqual(
    a.art,
    directionPlan(draft("hero-left", { seed: 123, grid: "60-40" })).art,
  );
  assert.notEqual(
    directionPlan(draft("hero-left", { seed: 123 })).framing.background.scale,
    directionPlan(draft("hero-left", { seed: 456 })).framing.background.scale,
  );
});

test("estreia alterna filme e data como elemento primário", () => {
  const film = build(draft("typography-dominant", { emphasis: "film" })),
    date = build(draft("typography-dominant", { emphasis: "date" }));
  assert.equal(
    film.elements.find((e) => e.id === "title").hierarchy,
    "primary",
  );
  assert.equal(
    date.elements.find((e) => e.id === "detail").hierarchy,
    "primary",
  );
  assert.ok(
    date.elements.find((e) => e.id === "detail").height >
      film.elements.find((e) => e.id === "detail").height,
  );
});

test("full bleed protege o centro mesmo quando o rosto liso parece pouco complexo", () => {
  const plan = directionPlan(
    draft("full-bleed"),
    { quietest: "left", focusX: 49, focusY: 38 },
    { fullBleed: true },
  );
  assert.ok(plan.slots.title[1] >= 0.6);
  const lateral = directionPlan(
    draft("full-bleed"),
    { quietest: "left", focusX: 78, focusY: 38 },
    { fullBleed: true },
  );
  assert.ok(lateral.slots.title[0] < 0.1);
});

test("layouts aprovados respeitam texto e marca nos três formatos", () => {
  for (const [id, height] of [
    ["square", 1080],
    ["feed_portrait", 1350],
    ["story", 1920],
  ])
    for (const style of Object.keys(DIRECTIONS)) {
      const scene = build(draft(style), { id, width: 1080, height });
      const quality = scoreComposition(scene);
      assert.ok(
        quality.accepted,
        `${style}/${id}: ${JSON.stringify(quality.issues)}`,
      );
    }
});

test("score reprova sobreposição, fonte pequena e texto fora da área segura", () => {
  const scene = build(draft()),
    title = scene.elements.find((e) => e.id === "title"),
    detail = scene.elements.find((e) => e.id === "detail");
  title.fontSize = 10;
  title.x = -10;
  detail.x = title.x;
  detail.y = title.y;
  const score = scoreComposition(scene);
  assert.equal(score.accepted, false);
  for (const code of ["TEXT_OVERLAP", "SMALL_TEXT", "SAFE_AREA"])
    assert.ok(score.issues.some((i) => i.code === code));
});

test("sombra e luz mantêm alfa baixo e bordas transparentes, sem aro retangular", async () => {
  const source = await solid("#8a3e31");
  for (const layer of ["glow", "ambient-shadow", "contact-shadow"]) {
    const result = await createCinematicArtwork(source, {
      width: 160,
      height: 200,
      fit: "contain",
      effects: { layer, shadow: 25, glow: 20, mask: "fade-all", blend: 75 },
    });
    const stats = await sharp(result).stats();
    assert.ok(
      stats.channels[3].max <= 65,
      `${layer}: alpha ${stats.channels[3].max}`,
    );
  }
});

test("contraste escolhe texto escuro no claro e claro no escuro", async () => {
  for (const [color, expected] of [
    ["#ffffff", "#101419"],
    ["#030303", "#ffffff"],
  ]) {
    const src = await solid(color);
    const scene = {
      width: 1080,
      height: 1350,
      backgroundColor: color,
      elements: [
        {
          id: "background-blur",
          type: "image",
          src: `asset://contrast-${color}`,
          visible: true,
          x: 0,
          y: 0,
          width: 1080,
          height: 1350,
          fit: "cover",
          effects: {},
        },
        { id: "copy-contrast", type: "gradient" },
        {
          id: "title",
          name: "Título",
          type: "text",
          text: "Teste",
          fill: "#ffffff",
          x: 100,
          y: 100,
          width: 500,
          height: 100,
        },
      ],
    };
    await ensureTextContrast(scene, async () => src);
    const title = scene.elements.find((e) => e.id === "title");
    assert.equal(title.fill, expected);
    assert.ok(title.contrastRatio >= 4.5);
  }
});

test("variações entregam quatro estruturas válidas e dados idênticos", async () => {
  const poster = await solid("#752324"),
    logo = await solid("#4488bb", 120, 60);
  const context = {
    brand,
    movies: [
      {
        id: "test",
        title: "A grande aventura",
        genres: ["Terror"],
        posterUrl: "asset://direction-poster",
        releaseDate: "2026-10-22",
      },
    ],
  };
  const result = await generateVariations(
    { ...draft(), auxiliaryText: "" },
    context,
    {
      loadImage: async (url) =>
        url === "asset://direction-logo" ? logo : poster,
    },
  );
  assert.equal(result.variations.length, 4);
  assert.equal(result.evaluatedCount, 8);
  assert.equal(result.variations[0].recommended, true);
  assert.deepEqual(result.variations.map(item => item.quality.total), result.variations.map(item => item.quality.total).sort((first, second) => second - first));
  assert.equal(new Set(result.variations.map((v) => v.draft.style)).size, 4);
  for (const v of result.variations) {
    assert.equal(v.draft.movieId, "test");
    assert.equal(v.draft.title, "A grande aventura");
    assert.ok(v.quality.accepted);
    assert.equal(v.draft.automaticStyle, false);
    if (v.refined) assert.ok(v.quality.total >= v.beforeQuality.total);
  }
  for (const variationMode of ["similar", "hierarchy"]) {
    const chosen = result.variations[0].draft;
    const regenerated = await generateVariations({ ...chosen, variationMode }, context, { loadImage: async url => url === "asset://direction-logo" ? logo : poster });
    assert.equal(regenerated.variations.length, 4);
    assert.equal(regenerated.evaluatedCount, variationMode === "similar" ? 6 : 8);
    assert.equal(new Set(regenerated.variations.map(item => item.draft.artDirection.seed)).size, 4);
    for (const item of regenerated.variations) {
      assert.equal(item.draft.artDirection.emphasis, chosen.artDirection.emphasis);
      assert.equal(item.draft.title, chosen.title);
      assert.equal(item.draft.cta, chosen.cta);
      if (variationMode === "similar") assert.equal(item.draft.style, chosen.style);
    }
  }
});
