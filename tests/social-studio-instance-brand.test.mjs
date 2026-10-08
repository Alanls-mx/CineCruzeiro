import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { signatureUrl } = require("../backend/services/social-studio/engine/renderer.js");
const { signatureForDraft } = require("../backend/services/socialStudioService.js");

const context = {
  brand: { logoUrl: "/images/logo-display.webp", posterLogoUrl: "/images/cine-estacao/assinatura-clara.webp" },
  signatures: [
    { id: "automatic", imageUrl: "" },
    { id: "classic", imageUrl: "/images/cine-estacao/assinatura-clara.webp" },
    { id: "wordmark-3d", imageUrl: "/images/logo-display.webp" },
    { id: "logo-3d", imageUrl: "/images/cine-estacao/assinatura-clara.webp" },
    { id: "none", imageUrl: "" },
  ],
};

test("Studio usa as assinaturas fornecidas pela instancia", () => {
  assert.equal(signatureUrl({ signatureId: "automatic" }, context), context.brand.posterLogoUrl);
  assert.equal(signatureUrl({ signatureId: "classic" }, context), context.brand.posterLogoUrl);
  assert.equal(signatureUrl({ signatureId: "wordmark-3d" }, context), context.brand.logoUrl);
  assert.equal(signatureUrl({ signatureId: "none" }, context), "");
  assert.equal(signatureForDraft({ signatureId: "automatic", templateId: "movie-premiere" }, context)?.imageUrl, context.brand.posterLogoUrl);
  assert.equal(signatureForDraft({ signatureId: "wordmark-3d", templateId: "movie-premiere" }, context)?.imageUrl, context.brand.logoUrl);
});
