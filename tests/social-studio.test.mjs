import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const {
  SOCIAL_FORMATS,
  SOCIAL_SIGNATURES,
  SOCIAL_TEMPLATES,
  buildSocialReadyPosts,
  captionForDraft,
  createHistoryRecord,
  draftNotices,
  hasCommercialPrice,
  minimumMoviePrice,
  normalizeBrand,
  normalizeDraft,
  posterSafeLayoutForDraft,
  renderSocialPost,
  signatureForDraft,
  sourceImageForDraft,
  wrapLines
} = require("../backend/services/socialStudioService");
const { ADMIN_PERMISSION_KEYS, roleAdminPermissions } = require("../backend/services/adminPermissionService");

async function image(width, height, color) {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

async function fixtureContext() {
  const assets = new Map([
    ["poster://horizontal", await image(1200, 500, "#2d4c8f")],
    ["poster://square", await image(700, 700, "#d4a91f")],
    ["poster://movie", await image(800, 1200, "#4338ca")],
    ["backdrop://movie", await image(1600, 900, "#0f766e")],
    ["product://combo", await image(1000, 1000, "#be123c")],
    ["/images/social-studio/cine-cruzeiro-icon-3d.png", await image(224, 224, "#0ea5e9")],
    ["/images/social-studio/cine-cruzeiro-wordmark-3d.png", await image(720, 240, "#2563eb")],
    ["/images/social-studio/cine-cruzeiro-logo-3d.png", await image(520, 297, "#1d4ed8")]
  ]);
  return {
    brand: {
      name: "Cinema de Teste",
      logoUrl: "poster://horizontal",
      website: "https://cinema.example",
      primaryColor: "#07111f",
      secondaryColor: "#1d4ed8",
      accentColor: "#facc15"
    },
    movies: [{
      id: "filme-longo",
      title: "Uma Jornada Extraordinariamente Longa Pela História do Cinema Brasileiro",
      posterUrl: "poster://movie",
      backdropUrl: "backdrop://movie",
      releaseDate: "2026-09-24",
      sessions: [{
        date: "2026-09-24",
        time: "19:30",
        startsAt: "2026-09-24T22:30:00.000Z",
        availableForPurchase: true,
        ticketTypes: [{ name: "Inteira", price: 28 }, { name: "Meia", price: 14.5 }]
      }]
    }, {
      id: "sem-imagem-preco",
      title: "Filme sem imagem e sem preço",
      posterUrl: "",
      backdropUrl: "",
      sessions: []
    }],
    concessions: [{ id: "combo", name: "Combo Grande", description: "Pipoca e dois refrigerantes", price: 39.9, imageUrl: "product://combo" }],
    clubPlans: [{ id: "familia", name: "Família", monthlyPrice: 59.9, benefits: ["Quatro ingressos", "Desconto na bomboniere"] }],
    loadImage: async (url) => assets.get(url) || null
  };
}

test("Social Studio expõe os seis templates e os três formatos solicitados", () => {
  assert.deepEqual(SOCIAL_TEMPLATES.map((item) => item.id), [
    "movie-price",
    "movie-highlight",
    "movie-premiere",
    "online-ticket",
    "concession-combo",
    "cinema-club"
  ]);
  assert.deepEqual(Object.values(SOCIAL_FORMATS).map(({ width, height }) => [width, height]), [
    [1080, 1350],
    [1080, 1080],
    [1080, 1920]
  ]);
});

test("assinaturas 3D ficam disponíveis e o modo automático respeita o tipo de pôster", async () => {
  const context = await fixtureContext();
  assert.deepEqual(SOCIAL_SIGNATURES.map((item) => item.id), [
    "automatic",
    "classic",
    "icon-3d",
    "wordmark-3d",
    "logo-3d",
    "none"
  ]);
  const premiere = normalizeDraft({ templateId: "movie-premiere", movieId: "filme-longo" }, context);
  const concession = normalizeDraft({ templateId: "concession-combo", concessionId: "combo" }, context);
  assert.equal(signatureForDraft(premiere, context).id, "logo-3d");
  assert.equal(signatureForDraft(concession, context).id, "icon-3d");
});

test("assinatura escolhida aparece na arte e permanece no histórico", async () => {
  const context = await fixtureContext();
  const selected = await renderSocialPost({
    templateId: "movie-highlight",
    formatId: "square",
    movieId: "filme-longo",
    signatureId: "wordmark-3d",
    signaturePosition: "top-right",
    signatureScale: 120
  }, context, { loadImage: context.loadImage });
  const without = await renderSocialPost({
    templateId: "movie-highlight",
    formatId: "square",
    movieId: "filme-longo",
    signatureId: "none"
  }, context, { loadImage: context.loadImage });
  assert.equal(selected.buffer.equals(without.buffer), false);
  const post = createHistoryRecord(selected, { savedImageUrl: "/uploads/social-studio/assinatura.png" }, context, "admin");
  assert.equal(post.payload.signatureId, "wordmark-3d");
  assert.equal(post.payload.signaturePosition, "top-right");
  assert.equal(post.payload.signatureScale, 120);
});

test("biblioteca pronta separa catálogo de lançamentos editoriais sem inventar venda", async () => {
  const context = await fixtureContext();
  context.movies[0].catalogued = true;
  context.movies.push({
    id: "editorial-futuro",
    title: "Filme Futuro",
    catalogued: false,
    status: "editorial",
    releaseDate: "2027-06-11",
    releaseLabel: "Previsto para junho de 2027",
    posterUrl: "poster://movie",
    backdropUrl: "",
    sessions: [],
    socialHook: "Uma nova aventura está a caminho.",
    editorialCaption: "Uma legenda editorial exclusiva para o lançamento futuro.",
    sourceName: "Estúdio oficial",
    sourceUrl: "https://example.com/release"
  });
  const posts = buildSocialReadyPosts(context);
  const catalog = posts.find((post) => post.collection === "catalog" && post.title.includes("Jornada"));
  const editorial = posts.find((post) => post.collection === "editorial");
  assert.ok(catalog);
  assert.equal(editorial.badge, "Ainda não cadastrado");
  assert.equal(editorial.draft.price, "");
  assert.equal(editorial.draft.cta, "ACOMPANHE AS NOVIDADES");
  assert.equal(editorial.caption, "Uma legenda editorial exclusiva para o lançamento futuro.");
  assert.notEqual(catalog.caption, editorial.caption);
});

test("templates informam categoria, campos condicionais e estilos reutilizáveis", () => {
  for (const template of SOCIAL_TEMPLATES) {
    assert.ok(template.category);
    assert.ok(Array.isArray(template.fields) && template.fields.includes("caption"));
    assert.ok(Array.isArray(template.styles) && template.styles.length >= 2);
  }
  assert.deepEqual([...new Set(SOCIAL_TEMPLATES.map((item) => item.category))], ["FILMES", "VENDAS", "BOMBONIERE", "CLUBE"]);
  assert.ok(!SOCIAL_TEMPLATES.find((item) => item.id === "movie-highlight").fields.includes("price"));
});

test("menor preço usa o valor real e preserva centavos", async () => {
  const context = await fixtureContext();
  assert.equal(minimumMoviePrice(context.movies[0]), 14.5);
  const draft = normalizeDraft({ templateId: "movie-price", movieId: "filme-longo" }, context);
  assert.equal(draft.price, "R$ 14,50");
});

test("filme sem preço recebe chamada segura sem inventar valor", async () => {
  const context = await fixtureContext();
  const draft = normalizeDraft({ templateId: "movie-price", movieId: "sem-imagem-preco" }, context);
  assert.equal(draft.price, "CONSULTE OS VALORES");
  assert.equal(hasCommercialPrice(draft.price), false);
  assert.match(draftNotices(draft, context).map((notice) => notice.message).join(" "), /Não encontramos um preço/);
});

test("preço promocional zerado não vira uma oferta comercial falsa", async () => {
  const context = await fixtureContext();
  context.movies.push({
    id: "apenas-gratuito",
    title: "Sessão gratuita",
    minimumPrice: 0,
    sessions: [{ ticketTypes: [{ name: "Cortesia", price: 0 }] }]
  });
  const draft = normalizeDraft({ templateId: "movie-price", movieId: "apenas-gratuito" }, context);
  assert.equal(draft.price, "CONSULTE OS VALORES");
});

test("brand sem cor secundária recebe fallback válido", () => {
  const brand = normalizeBrand({ name: "Cinema", primaryColor: "#111111", accentColor: "#ffee00" });
  assert.match(brand.secondaryColor, /^#[0-9a-f]{6}$/);
  assert.equal(brand.primaryColor, "#111111");
});

test("quebra de título longo limita linhas e não deixa palavra vazia", () => {
  const lines = wrapLines("Um título muito longo para validar a composição automática sem cortar o conteúdo fora da arte", 24, 3);
  assert.ok(lines.length <= 3);
  assert.ok(lines.every((line) => line.trim().length > 0));
  assert.ok(lines.at(-1).length <= 24);
});

for (const [formatId, format] of Object.entries(SOCIAL_FORMATS)) {
  test(`exporta ${formatId} em PNG nas dimensões exatas`, async () => {
    const context = await fixtureContext();
    const rendered = await renderSocialPost({
      templateId: "movie-price",
      formatId,
      outputType: "png",
      movieId: "filme-longo"
    }, context, { loadImage: context.loadImage });
    const metadata = await sharp(rendered.buffer).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, format.width);
    assert.equal(metadata.height, format.height);
  });
}

test("exporta JPG de alta qualidade com logo quadrada", async () => {
  const context = await fixtureContext();
  context.brand.logoUrl = "poster://square";
  const rendered = await renderSocialPost({
    templateId: "movie-highlight",
    formatId: "square",
    outputType: "jpg",
    movieId: "filme-longo"
  }, context, { loadImage: context.loadImage });
  const metadata = await sharp(rendered.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1080);
});

test("renderiza filme sem backdrop e sem poster usando fundo da identidade", async () => {
  const context = await fixtureContext();
  const rendered = await renderSocialPost({
    templateId: "movie-premiere",
    formatId: "story",
    movieId: "sem-imagem-preco"
  }, context, { loadImage: context.loadImage });
  const metadata = await sharp(rendered.buffer).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
});

test("imagem automática escolhe backdrop no feed, pôster no story e respeita upload", async () => {
  const context = await fixtureContext();
  const feed = normalizeDraft({ templateId: "movie-highlight", formatId: "feed_portrait", movieId: "filme-longo" }, context);
  const story = normalizeDraft({ templateId: "movie-highlight", formatId: "story", movieId: "filme-longo" }, context);
  const upload = normalizeDraft({ templateId: "movie-highlight", movieId: "filme-longo", imageMode: "upload", imageUrl: "poster://square" }, context);
  assert.equal(sourceImageForDraft(feed), "backdrop://movie");
  assert.equal(sourceImageForDraft(story), "poster://movie");
  assert.equal(sourceImageForDraft(upload), "poster://square");
});

test("pôster recebe área exclusiva sem conteúdo sobre a arte", async () => {
  const context = await fixtureContext();
  for (const formatId of Object.keys(SOCIAL_FORMATS)) {
    const draft = normalizeDraft({
      templateId: "movie-premiere",
      formatId,
      movieId: "filme-longo",
      imageMode: "poster"
    }, context);
    const layout = posterSafeLayoutForDraft(draft, SOCIAL_FORMATS[formatId]);
    assert.ok(layout);
    if (formatId === "story") {
      assert.ok(layout.poster.top + layout.poster.height < layout.panelTop);
    } else {
      assert.ok(layout.poster.left + layout.poster.width < layout.copy.left);
    }
  }
});

test("ajustes controlados de imagem e composição permanecem no histórico", async () => {
  const context = await fixtureContext();
  const rendered = await renderSocialPost({
    templateId: "movie-highlight",
    formatId: "feed_portrait",
    movieId: "filme-longo",
    style: "impact",
    imagePreset: "right",
    imagePositionX: 78,
    imagePositionY: 34,
    imageScale: 138,
    overlayIntensity: 64,
    darken: 12,
    blur: 2,
    contentPosition: "center",
    alignment: "center",
    titleScale: 112,
    paletteMode: "dynamic"
  }, context, { loadImage: context.loadImage });
  const post = createHistoryRecord(rendered, { savedImageUrl: "/uploads/social-studio/test.png" }, context, "admin");
  assert.equal(post.payload.style, "impact");
  assert.equal(post.payload.imagePreset, "right");
  assert.equal(post.payload.imageScale, 138);
  assert.equal(post.payload.alignment, "center");
  assert.equal(post.status, "ready");
  assert.equal(post.contentName, context.movies[0].title);
});

test("variações visuais usam os mesmos dados e mantêm a dimensão final", async () => {
  const context = await fixtureContext();
  for (const style of ["cinematic", "impact", "clean", "minimal"]) {
    const rendered = await renderSocialPost({
      templateId: "movie-highlight",
      formatId: "square",
      movieId: "filme-longo",
      style
    }, context, { loadImage: context.loadImage });
    const metadata = await sharp(rendered.buffer).metadata();
    assert.deepEqual([metadata.width, metadata.height], [1080, 1080]);
    assert.equal(rendered.draft.style, style);
  }
});

test("templates de bomboniere e clube consomem entidades existentes", async () => {
  const context = await fixtureContext();
  const combo = normalizeDraft({ templateId: "concession-combo", concessionId: "combo" }, context);
  const plan = normalizeDraft({ templateId: "cinema-club", clubPlanId: "familia" }, context);
  assert.equal(combo.title, "Combo Grande");
  assert.equal(combo.price, "R$ 39,90");
  assert.equal(plan.title, "Família");
  assert.match(plan.auxiliaryText, /Quatro ingressos/);
});

test("legenda determinística usa cinema, conteúdo e link configurados", async () => {
  const context = await fixtureContext();
  const caption = captionForDraft({ templateId: "movie-price", movieId: "filme-longo" }, context);
  assert.match(caption, /Cinema de Teste/);
  assert.match(caption, /cinema\.example/);
  assert.match(caption, /R\$\s?14,50/);
});

test("permissões do Social Studio são granulares e entram no perfil gerente", () => {
  for (const permission of ["social_studio.view", "social_studio.create", "social_studio.delete"]) {
    assert.ok(ADMIN_PERMISSION_KEYS.includes(permission));
    assert.ok(roleAdminPermissions("manager").includes(permission));
  }
  assert.ok(!roleAdminPermissions("operator").includes("social_studio.delete"));
});

test("painel registra módulo independente e não o mistura ao formulário de e-mail", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  const client = await readFile(new URL("../backend/public/social-studio.js", import.meta.url), "utf8");
  assert.match(html, /data-admin-tab="social"/);
  assert.match(html, /id="socialStudioRoot"/);
  assert.match(client, /\/api\/admin\/social-studio\/preview/);
  assert.match(client, /\/api\/admin\/social-studio\/campaigns/);
  assert.match(client, /schedulePreview\(460\)/);
  assert.match(client, /socialStudioCopyCaption/);
  assert.doesNotMatch(client, /emailCampaignForm|\/api\/admin\/email/);
});
