import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const engine = require("../backend/services/socialStudioEngineService");

async function solid(width, height, background) {
  return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
}

async function fixture() {
  const assets = new Map([
    ["asset://poster", await solid(800, 1200, "#5c1420")],
    ["asset://logo", await solid(600, 260, "#1268d7")]
  ]);
  return {
    context: {
      brand: { name: "Cine Cruzeiro", logoUrl: "asset://logo", posterLogoUrl: "asset://logo", posterWebsite: "www.cinecruzeiro.com.br", primaryColor: "#07111f", secondaryColor: "#1268d7", accentColor: "#f4c400", textColor: "#ffffff" },
      movies: [{
        id: "movie-1",
        title: "Filme de Teste",
        posterUrl: "asset://poster",
        backdropUrl: "",
        releaseDate: "2026-10-22",
        sessions: [{ date: "2026-10-22", time: "19:30", ticketTypes: [{ name: "Inteira", price: 20 }] }]
      }]
    },
    loadImage: async (url) => assets.get(url) || null
  };
}

test("cena V2 separa conteúdo, imagem e assinatura protegida", async () => {
  const { context, loadImage } = await fixture();
  const rendered = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-1", formatId: "feed_portrait" }, context, { loadImage });
  assert.equal(rendered.scene.rendererVersion, "v2-konva");
  assert.ok(rendered.scene.elements.find((element) => element.role === "title" && element.type === "text"));
  assert.ok(rendered.scene.elements.find((element) => element.role === "background" && element.type === "image"));
  assert.equal(rendered.scene.elements.find((element) => element.role === "logo")?.protected, true);
});

test("normalização da cena limita tipos, cores e quantidade de elementos", () => {
  const scene = engine.normalizeScene({
    width: 99999,
    height: 2,
    backgroundColor: "url(javascript:alert(1))",
    elements: [
      ...Array.from({ length: 90 }, (_, index) => ({ id: `text-${index}`, type: "text", text: "Teste", fill: index === 0 ? "expression(alert(1))" : "#ffffff", width: 200, height: 50 })),
      { id: "script", type: "script", text: "alert(1)" }
    ]
  });
  assert.equal(scene.width, 2160);
  assert.equal(scene.height, 320);
  assert.equal(scene.backgroundColor, "#050b16");
  assert.equal(scene.elements.length, 80);
  assert.equal(scene.elements[0].fill, "#ffffff");
});

test("renderização manual permanece no servidor e respeita tamanho e formato", async () => {
  const { context, loadImage } = await fixture();
  const automatic = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-1", formatId: "square" }, context, { loadImage });
  const title = automatic.scene.elements.find((element) => element.role === "title");
  title.text = "Título ajustado pelo operador";
  title.x += 15;
  const rendered = await engine.renderSocialScene(automatic.scene, { loadImage, outputType: "jpg" });
  const metadata = await sharp(rendered.buffer).metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.format], [1080, 1080, "jpeg"]);
  assert.equal(rendered.scene.elements.find((element) => element.role === "title").text, "Título ajustado pelo operador");
});

test("histórico mantém original automático separado da futura edição", async () => {
  const { context, loadImage } = await fixture();
  const rendered = await engine.renderSocialPost({ templateId: "movie-premiere", movieId: "movie-1" }, context, { loadImage });
  const record = engine.createHistoryRecord(rendered, { savedImageUrl: "/uploads/social-studio/original.png" }, context, { id: "admin-1" });
  assert.equal(record.activeVersion, "automatic");
  assert.equal(record.originalImageUrl, "/uploads/social-studio/original.png");
  assert.equal(record.originalScene.rendererVersion, "v2-konva");
  assert.equal(record.editedScene, null);
  assert.equal(record.sceneVersions[0].kind, "automatic");
});

test("painel expõe editor opcional e API cobre rascunho, versão, exportação e restauração", () => {
  const admin = fs.readFileSync(new URL("../backend/public/social-studio.js", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../src/components/social-editor/SocialEditor.tsx", import.meta.url), "utf8");
  assert.match(admin, /Editar detalhes/);
  assert.match(admin, /social-editor\?postId=/);
  for (const action of ["scene-draft", "scene-versions", "scene-export", "scene-reset"]) assert.match(server, new RegExp(action));
  assert.match(editor, /autosave|scene-draft/i);
  assert.match(editor, /Ctrl\+Z|keydown/);
  assert.doesNotMatch(editor, /email/i);
});
