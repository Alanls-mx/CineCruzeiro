import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const engine = require("../backend/services/socialStudioEngineService");
const { buildEditableScene, LAYOUTS, wrapText } = require("../backend/services/social-studio/scene/factory");
const { PALETTES, applyPalette } = require("../backend/services/social-studio/engine/palette");
const brand = { name: "Cine Cruzeiro", website: "www.cinecruzeiro.com.br", primaryColor: "#07111f", accentColor: "#facc15" };
const palette = { dominantColor: "#231519", accentColor: "#df414c", secondaryColor: "#832029" };
const formats = [{ id: "square", width: 1080, height: 1080 }, { id: "feed_portrait", width: 1080, height: 1350 }, { id: "story", width: 1080, height: 1920 }];
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const format of formats) {
  test(`layouts reservam zonas sem sobreposição: ${format.id}`, () => {
    const signatures = new Set();
    for (const style of Object.keys(LAYOUTS)) {
      for (const template of engine.SOCIAL_TEMPLATES) {
        const draft = { style, templateId: template.id, title: "Uma Grande Aventura: O Retorno de Uma História Extraordinária", subtitle: "ESTREIA NO CINEMA", date: "22 DE OUTUBRO", price: "R$ 25,90", auxiliaryText: "Sessões às 14h, 16h30 e 19h. Confira os horários e a classificação indicativa antes de comprar.", cta: "GARANTA SEU LUGAR", titleScale: 125, signatureScale: 135 };
        const scene = buildEditableScene({ draft, format, brand, palette, sourceUrl: "asset://poster", logoUrl: "asset://logo" });
        const art = scene.elements.find((item) => item.id === "artwork");
        signatures.add(JSON.stringify([art.x, art.y, art.width, art.height]));
        const texts = scene.elements.filter((item) => item.type === "text");
        for (const element of scene.elements) {
          assert.ok(element.x >= 0 && element.y >= 0, `${style}: ${element.id} começa fora da tela`);
          assert.ok(element.x + element.width <= scene.width + 1 && element.y + element.height <= scene.height + 1, `${style}: ${element.id} excede a tela`);
        }
        assert.equal(art.fit, "contain");
        for (const element of texts) {
          assert.ok(!overlap(art, element), `${style}: ${element.id} cobre a arte`);
          const lines = element.text.split("\n");
          assert.ok(lines.length * element.fontSize * element.lineHeight <= element.height + 1, `${style}: ${element.id} corta texto`);
          for (const other of texts) if (other !== element) assert.ok(!overlap(element, other), `${style}: ${element.id} cobre ${other.id}`);
          if (format.id === "story") assert.ok(element.y + element.height < scene.height * .90);
        }
      }
    }
    assert.equal(signatures.size, 4);
  });
}

test("paletas têm cores distintas e persistem no histórico", () => {
  const accents = new Set();
  for (const preset of PALETTES) {
    const draft = engine.normalizeDraft({ paletteId: preset.id });
    assert.equal(draft.paletteId, preset.id);
    accents.add(applyPalette(palette, preset.id).accentColor);
    const record = engine.createHistoryRecord({ draft, format: formats[0], extension: ".png" }, {}, {});
    assert.equal(record.payload.paletteId, preset.id);
  }
  assert.equal(accents.size, PALETTES.length);
  assert.equal(engine.normalizeDraft({ paletteId: "invalid" }).paletteId, "automatic");
});

test("títulos extensos cabem sem truncar palavras", () => {
  const title = "Uma aventura inesperada ".repeat(6).trim();
  const fitted = wrapText(title, 345, 145, 110, 5);
  assert.equal(fitted.text.replace(/\n/g, " "), title);
  assert.ok(fitted.text.split("\n").length * fitted.fontSize * 1.12 <= 145);
});

function loadTs(file) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../src/components/social-editor/${file}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, crypto, require: (id) => loadTs(id.replace("./", "")) });
  return exports;
}
const serializer = loadTs("SceneSerializer");
const history = loadTs("HistoryManager");
const group = { id: "cta", type: "group", name: "Chamada", width: 400, height: 100, x: 0, y: 0, children: [{ id: "cta-text", type: "text", name: "Texto", x: 10, y: 10, width: 380, height: 80, fontSize: 24 }] };

test("duplicar grupos gera IDs únicos e mantém a hierarquia", () => {
  const scene = { elements: [group] };
  const copy = serializer.duplicateElement(scene, "cta");
  assert.equal(copy.scene.elements.length, 2);
  assert.notEqual(copy.id, "cta");
  assert.notEqual(copy.scene.elements[1].children[0].id, "cta-text");
  const ids = copy.scene.elements.flatMap((item) => [item.id, item.children[0].id]);
  assert.equal(new Set(ids).size, 4);
});

test("redimensionamento de grupo acompanha filhos, fonte e proporção", () => {
  const resized = serializer.patchGeometry(group, { width: 800, height: 200 });
  assert.equal(resized.children[0].width, 760);
  assert.equal(resized.children[0].fontSize, 48);
  assert.equal(serializer.patchGeometry({ ...group, keepRatio: true }, { width: 800 }).height, 200);
});

test("bloqueio do grupo é herdado e edição de texto pode ser desfeita", () => {
  const scene = { elements: [{ ...group, locked: true }] };
  assert.equal(serializer.isElementLocked(scene, "cta-text"), true);
  const initial = history.createHistory(scene);
  const edited = serializer.mapElement(scene, "cta-text", (element) => ({ ...element, text: "Novo texto" }));
  const changed = history.commitHistory(initial, edited);
  assert.equal(JSON.stringify(history.undoHistory(changed).present), JSON.stringify(scene));
  assert.equal(JSON.stringify(history.redoHistory(history.undoHistory(changed)).present), JSON.stringify(edited));
});
