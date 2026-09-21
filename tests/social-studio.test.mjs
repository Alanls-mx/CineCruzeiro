import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const {
  SOCIAL_FORMATS,
  SOCIAL_TEMPLATES,
  captionForDraft,
  minimumMoviePrice,
  normalizeBrand,
  normalizeDraft,
  renderSocialPost,
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
    ["product://combo", await image(1000, 1000, "#be123c")]
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
  assert.doesNotMatch(client, /emailCampaignForm|\/api\/admin\/email/);
});
