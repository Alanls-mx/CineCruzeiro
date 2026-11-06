import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "backend", "public");
const html = fs.readFileSync(path.join(publicRoot, "admin.html"), "utf8");
const shell = fs.readFileSync(path.join(publicRoot, "admin.js"), "utf8");
const require = createRequire(import.meta.url);

test("admin shell loads each local module before composition without inline handlers", () => {
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1].split("?")[0]);
  const modulePaths = scripts.filter((entry) => entry.startsWith("admin-modules/"));
  assert.equal(modulePaths.length, 30);
  assert.equal(new Set(modulePaths).size, modulePaths.length);
  assert.ok(scripts.indexOf("jsQR.js") < scripts.indexOf(modulePaths[0]));
  assert.ok(modulePaths.every((entry) => scripts.indexOf(entry) < scripts.indexOf("admin.js")));
  assert.ok(scripts.indexOf("admin.js") < scripts.indexOf("social-studio.js"));
  assert.doesNotMatch(html, /\son(?:click|submit|change|input|keydown)\s*=/i);
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i);
});

test("every module consumed by the shell has a frozen named API", () => {
  const expectedNames = new Set([...shell.matchAll(/window\.CineAdminModules\.([A-Za-z]\w*)/g)].map((match) => match[1]));
  const moduleFiles = fs.readdirSync(path.join(publicRoot, "admin-modules")).filter((file) => file.endsWith(".js"));
  const loadedFiles = [...html.matchAll(/<script\b[^>]*\bsrc="admin-modules\/([^"?]+)(?:\?[^"]*)?"/g)].map((match) => match[1]);
  assert.deepEqual(moduleFiles.toSorted(), loadedFiles.toSorted());
  const published = new Set();
  for (const file of moduleFiles) {
    const source = fs.readFileSync(path.join(publicRoot, "admin-modules", file), "utf8");
    const match = source.match(/root\.CineAdminModules\.([A-Za-z]\w*)\s*=\s*api/);
    assert.ok(match, `${file} does not publish its API`);
    const name = match[1];
    assert.ok(!published.has(name), `duplicate module name ${name}`);
    published.add(name);
    const api = require(path.join(publicRoot, "admin-modules", file));
    assert.ok(Object.isFrozen(api), `${file} API is mutable`);
    assert.ok(Object.values(api).every((member) => typeof member === "function"), `${file} has an unexpected export`);
  }
  for (const name of expectedNames) assert.ok(published.has(name), `admin.js requires missing module ${name}`);
});
