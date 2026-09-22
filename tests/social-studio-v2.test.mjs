import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const engine = require("../backend/services/socialStudioEngineService");

async function image(width, height, background) {
  return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
}

async function fixture() {
  const poster = await image(800, 1200, "#601416");
  const backdrop = await image(1600, 900, "#163f72");
  const logo = await image(600, 300, { r: 15, g: 93, b: 210, alpha: 0.9 });
  const product = await image(900, 900, "#d19420");
  const assets = new Map([
    ["asset://poster", poster],
    ["asset://backdrop", backdrop],
    ["asset://logo", logo],
    ["asset://product", product]
  ]);
  const genres = ["Terror", "Animação", "Ação", "Drama", "Romance"];
  return {
    context: {
      brand: {
        name: "Cine Teste",
        logoUrl: "asset://logo",
        posterLogoUrl: "asset://logo",
        website: "https://cinema.example",
        posterWebsite: "www.cinema.example",
        primaryColor: "#07111f",
        secondaryColor: "#1d4ed8",
        accentColor: "#facc15",
        textColor: "#ffffff"
      },
      movies: genres.map((genre, index) => ({
        id: `movie-${index}`,
        title: index === 0 ? "Uma História Extraordinariamente Longa de Terror" : `${genre} em Cartaz`,
        genres: [genre],
        posterUrl: index === 3 ? "" : "asset://poster",
        backdropUrl: index === 4 ? "" : "asset://backdrop",
        releaseDate: "2026-10-22",
        sessions: [{ date: "2026-10-22", time: "19:30", availableForPurchase: true, ticketTypes: index === 1 ? [] : [{ name: "Inteira", price: 20 }] }]
      })),
      concessions: [{ id: "combo", name: "Combo Casal", description: "Pipoca grande • 2 refrigerantes", price: 39.9, imageUrl: "asset://product" }],
      clubPlans: [{ id: "familia", name: "Família", monthlyPrice: 59.9, benefits: ["Quatro ingressos", "Desconto na bomboniere"] }]
    },
    loadImage: async (url) => assets.get(url) || null
  };
}

test("Engine V2 registra os sete templates estruturados", () => {
  assert.deepEqual(engine.SOCIAL_TEMPLATES.map((template) => template.id), [
    "movie-premiere", "movie-highlight", "movie-price", "movie-presale",
    "online-ticket", "concession-combo", "club-plan"
  ]);
  for (const template of engine.SOCIAL_TEMPLATES) {
    assert.ok(template.formats.length === 3);
    assert.ok(template.styles.length >= 2);
    assert.ok(Array.isArray(template.fields));
  }
});

test("recomendação por gênero permanece substituível pelo administrador", async () => {
  const { context } = await fixture();
  const expected = ["cinematic", "impact", "impact", "cinematic", "clean"];
  context.movies.forEach((movie, index) => {
    const draft = engine.normalizeDraft({ templateId: "movie-premiere", movieId: movie.id, style: "automatic" }, context);
    assert.equal(draft.style, expected[index]);
  });
  const manual = engine.normalizeDraft({ templateId: "movie-premiere", movieId: "movie-0", style: "clean" }, context);
  assert.equal(manual.style, "clean");
});

test("fixtures de terror, animação, ação, drama e romance renderizam com variações de asset", async () => {
  const { context, loadImage } = await fixture();
  for (const movie of context.movies) {
    const rendered = await engine.renderSocialPost({
      templateId: "movie-premiere",
      movieId: movie.id,
      formatId: "feed_portrait",
      style: "automatic"
    }, context, { loadImage });
    const metadata = await sharp(rendered.buffer).metadata();
    assert.deepEqual([metadata.width, metadata.height], [1080, 1350]);
    assert.ok(engine.SOCIAL_TEMPLATES[0].styles.includes(rendered.draft.style));
  }
});

test("logos clara, escura, horizontal e quadrada preservam o output", async () => {
  const { context, loadImage } = await fixture();
  const logos = [
    await image(720, 240, "#ffffff"),
    await image(720, 240, "#07111f"),
    await image(900, 260, "#1d4ed8"),
    await image(500, 500, "#facc15")
  ];
  for (let index = 0; index < logos.length; index += 1) {
    const logoUrl = `asset://logo-${index}`;
    const rendered = await engine.renderSocialPost({
      templateId: "movie-highlight",
      movieId: "movie-2",
      formatId: index % 2 === 0 ? "square" : "story"
    }, { ...context, brand: { ...context.brand, logoUrl, posterLogoUrl: logoUrl } }, {
      loadImage: async (url) => url === logoUrl ? logos[index] : loadImage(url)
    });
    assert.ok(rendered.buffer.length > 10_000);
  }
});

test("renderer Satori + Sharp entrega PNG e JPG nas dimensões exatas", async () => {
  const { context, loadImage } = await fixture();
  for (const [formatId, dimensions] of Object.entries({ feed_portrait: [1080, 1350], square: [1080, 1080], story: [1080, 1920] })) {
    const rendered = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-0", formatId }, context, { loadImage });
    const metadata = await sharp(rendered.buffer).metadata();
    assert.deepEqual([metadata.width, metadata.height], dimensions);
    assert.equal(metadata.format, "png");
    assert.equal(rendered.rendererVersion, "v2");
    assert.ok(rendered.buffer.length < 5 * 1024 * 1024);
  }
  const jpg = await engine.renderSocialPost({ templateId: "movie-highlight", movieId: "movie-2", formatId: "square", outputType: "jpg" }, context, { loadImage });
  assert.equal((await sharp(jpg.buffer).metadata()).format, "jpeg");
});

test("templates V2 reagem a imagem e preço ausentes sem quebrar", async () => {
  const { context, loadImage } = await fixture();
  context.movies.push({
    id: "movie-no-art",
    title: "Filme sem material visual",
    genres: ["Drama"],
    posterUrl: "",
    backdropUrl: "",
    releaseDate: "2026-11-01",
    sessions: []
  });
  const withoutPoster = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-3", formatId: "feed_portrait" }, context, { loadImage });
  const withoutArtwork = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-no-art", formatId: "square" }, context, { loadImage });
  const withoutPrice = await engine.renderSocialPost({ templateId: "movie-price", movieId: "movie-1", formatId: "feed_portrait", price: "" }, context, { loadImage });
  assert.deepEqual([
    (await sharp(withoutPoster.buffer).metadata()).width,
    (await sharp(withoutArtwork.buffer).metadata()).width,
    (await sharp(withoutPrice.buffer).metadata()).width
  ], [1080, 1080, 1080]);
  assert.equal(engine.hasCommercialPrice(withoutPrice.draft.price), false);
});

test("bomboniere, clube, institucional e pré-venda usam entidades existentes", async () => {
  const { context, loadImage } = await fixture();
  const inputs = [
    { templateId: "movie-presale", movieId: "movie-2" },
    { templateId: "concession-combo", concessionId: "combo" },
    { templateId: "club-plan", clubPlanId: "familia" },
    { templateId: "online-ticket" }
  ];
  for (const input of inputs) {
    const rendered = await engine.renderSocialPost({ ...input, formatId: "square" }, context, { loadImage });
    assert.equal((await sharp(rendered.buffer).metadata()).width, 1080);
  }
});

test("API interna gera campanha adaptada e registra desempenho", async () => {
  const { context, loadImage } = await fixture();
  const campaign = await engine.generateSocialCampaign({
    template: "movie-premiere",
    subject: { movieId: "movie-0", outputType: "png" },
    formats: ["feed_portrait", "square", "story"],
    cinema: context.brand
  }, context, { loadImage });
  assert.equal(campaign.rendererVersion, "v2");
  assert.equal(campaign.items.length, 3);
  assert.ok(campaign.metrics.totalMs > 0);
  assert.ok(campaign.metrics.averageMs > 0);
  assert.ok(campaign.metrics.totalMs < 15000);
});

test("histórico V2 preserva identificação e autoria sem alterar registros antigos", async () => {
  const { context, loadImage } = await fixture();
  const rendered = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-0" }, context, { loadImage });
  const record = engine.createHistoryRecord(rendered, { savedImageUrl: "/uploads/social-studio/test.png" }, context, { id: "admin-1", name: "Operador Teste" });
  assert.equal(record.rendererVersion, "v2");
  assert.equal(record.payload.rendererVersion, "v2");
  assert.equal(record.createdByName, "Operador Teste");
});
