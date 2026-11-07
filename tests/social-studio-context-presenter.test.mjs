import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createSocialStudioContextPresenter } = require("../backend/services/socialStudioContextPresenter.js");

const { socialStudioBrand, socialStudioContext } = createSocialStudioContextPresenter({
  appFrontendUrl: () => "https://cinema.example.test",
  buildCommercialCatalog: () => ({ movies: [], concessions: [], promotions: [] }),
  buildSocialReadyPosts: () => [],
  configuredAppBasePath: () => "",
  normalizeSocialBrand: (brand) => brand,
  publicAssetUrl: (url) => url,
  publicSocialStudioPost: (post) => ({ id: post.id }),
  slugify: (text) => String(text || "").toLowerCase(),
  SOCIAL_FORMATS: { feed: { id: "feed", width: 1080, height: 1350 } },
  SOCIAL_SIGNATURES: [],
  SOCIAL_STUDIO_EDITORIAL_MOVIES: [],
  SOCIAL_STYLES: [],
  SOCIAL_TEMPLATES: []
});

test("Studio context uses installation settings and excludes private history fields", () => {
  const db = { settings: {
    cinemaName: "Cinema de Teste",
    socialStudioBrand: { website: "https://cinema.example.test" },
    socialStudioPosts: [{ id: "post-1", privateToken: "secret" }]
  }, subscriptionPlans: [] };
  assert.equal(socialStudioBrand(db).name, "Cinema de Teste");
  const context = socialStudioContext(db);
  assert.equal(context.brand.website, "https://cinema.example.test");
  assert.deepEqual(context.history, [{ id: "post-1" }]);
  assert.equal(JSON.stringify(context).includes("secret"), false);
  assert.equal(context.formats[0].id, "feed");
});
