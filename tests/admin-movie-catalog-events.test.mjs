import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { bindMovieCatalogEvents } = require("../backend/public/admin-modules/movie-catalog-events.js");

test("lista de filmes registra filtros, ações e arraste uma vez", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/movie-catalog-events.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /movieCatalogEvents\.bindMovieCatalogEvents/);

  const listeners = new Map();
  const elements = new Map(["movieCatalogSearch", "movieCatalogFilter", "moviesList"].map((id) => [id, {
    addEventListener(name, callback) { listeners.set(`${id}:${name}`, callback); }
  }]));
  const calls = [];
  const state = { moviesPage: 3 };
  bindMovieCatalogEvents({
    $: (id) => elements.get(id), state,
    renderMovies: (options) => calls.push(["render", options]),
    toggleMovieMenu: (id) => calls.push(["menu", id]),
    duplicateMovie: (id) => calls.push(["duplicate", id]),
    moveMovie: (id, direction) => calls.push(["move", id, direction]),
    archiveMovie: (id) => calls.push(["archive", id]),
    deleteMovie: (id) => calls.push(["delete", id]),
    selectMovie: (id) => calls.push(["select", id]),
    handleMovieDragStart: (_event, id) => calls.push(["dragstart", id]),
    handleMovieDragOver: () => calls.push(["dragover"]),
    handleMovieDragLeave: () => calls.push(["dragleave"]),
    handleMovieDragEnd: () => calls.push(["dragend"]),
    handleMovieDrop: (_event, id) => calls.push(["drop", id])
  });
  assert.equal(listeners.size, 8);
  listeners.get("movieCatalogSearch:input")();
  assert.equal(state.moviesPage, 1);
  assert.deepEqual(calls.pop(), ["render", { preserveForm: true }]);

  const row = { dataset: { movieId: "filme-1" } };
  const target = (action = "") => ({ closest(selector) {
    if (selector === ".movie-row[data-movie-id]" || selector === ".movie-row") return row;
    if (selector === ".movie-row-actions") return action ? {} : null;
    if (selector === "[data-movie-action]") return action ? { dataset: { movieAction: action } } : null;
    return null;
  } });
  listeners.get("moviesList:click")({ target: target(), stopPropagation() {} });
  listeners.get("moviesList:click")({ target: target("move-up"), stopPropagation() {} });
  listeners.get("moviesList:dragstart")({ target: target() });
  listeners.get("moviesList:drop")({ target: target() });
  assert.deepEqual(calls, [["select", "filme-1"], ["move", "filme-1", -1], ["dragstart", "filme-1"], ["drop", "filme-1"]]);
});
