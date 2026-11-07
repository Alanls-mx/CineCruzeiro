import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const publicCode = source.slice(source.indexOf("function publicSocialStudioPost("), source.indexOf("async function editableSceneForPost("));
const publicSocialStudioPost = vm.runInNewContext(`${publicCode}\npublicSocialStudioPost`);
const downloadCode = source.slice(source.indexOf("function socialStudioDownloadName("), source.indexOf("const { parseAdminPeriod", source.indexOf("function socialStudioDownloadName(")));
const socialStudioDownloadName = vm.runInNewContext(`${downloadCode}\nsocialStudioDownloadName`, { slugify: (value) => String(value).toLowerCase().replace(/\s+/g, "-") });

test("Studio oculta cenas e preserva indicadores de edição no histórico público", () => {
  const post = { title: "Post", originalScene: { secret: 1 }, draftScene: { secret: 2 }, editedScene: { secret: 3 },
    sceneVersions: [{ id: "v1", scene: { secret: 4 } }], rendererVersion: "v2" };
  const projected = publicSocialStudioPost(post);
  assert.equal(projected.originalScene, undefined);
  assert.equal(projected.draftScene, undefined);
  assert.equal(projected.editedScene, undefined);
  assert.equal(projected.sceneVersions[0].scene, undefined);
  assert.equal(projected.sceneVersions[0].id, "v1");
  assert.equal(projected.editable, true);
  assert.equal(projected.hasEditedScene, true);
  assert.equal(projected.hasDraftScene, true);
  assert.equal(post.originalScene.secret, 1);
});

test("Studio preserva nome de download e extensão", () => {
  assert.equal(socialStudioDownloadName({ title: "Oferta Especial", outputType: "jpg", formatId: "story" }), "oferta-especial-story.jpg");
  assert.equal(socialStudioDownloadName({}), "post-social.png");
});
