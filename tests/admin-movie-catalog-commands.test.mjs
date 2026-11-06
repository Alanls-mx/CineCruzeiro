import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createMovieCatalogCommands } = require("../backend/public/admin-modules/movie-catalog-commands.js");

test("catalog reorder keeps one PUT and updates the shared collection after response", async () => {
  const state = { content: { movies: [
    { id: "a", title: "A", sortOrder: 10 }, { id: "b", title: "B", sortOrder: 20 }
  ] } };
  const calls = [];
  const view = createMovieCatalogCommands({ state,
    api: async (path, options) => {
      calls.push([path, options]);
      return { movies: [{ id: "b", title: "B", sortOrder: 10 }, { id: "a", title: "A", sortOrder: 20 }] };
    }, renderMovies: () => calls.push(["render"]), setStatus: () => {}, showToast: () => {}
  });
  await view.saveMovieOrder(["b", "a"]);
  assert.equal(calls.filter(([path]) => path === "/api/movies/order").length, 1);
  assert.equal(calls[0][1].method, "PUT");
  assert.deepEqual(JSON.parse(calls[0][1].body).ids, ["b", "a"]);
  assert.equal(state.content.movies[0].id, "b");
  assert.equal(calls[1][0], "render");
});

test("movie creation prevents a second submit while request is pending", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", checked: false });
    return elements.get(id);
  };
  $("movieSlug").value = "filme-qa";
  $("movieTitle").value = "Filme QA";
  $("movieCatalogPosition").value = "1";
  const state = { content: { movies: [] }, selectedMovieId: "", creating: { movie: true }, movieDraftMetadata: {} };
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const view = createMovieCatalogCommands({ state, $,
    validateMovieWizardStep: () => true, setDisabled: () => {},
    slugify: String, currentMovie: () => null,
    api: async (path, options) => {
      calls.push([path, options]);
      if (path === "/api/movies") return pending;
      return { movies: state.content.movies };
    },
    upsertAdminCollection: (key, item) => { state.content[key].push(item); },
    renderMovies: () => {}, showToast: () => {}, showSuccess: () => {}, setStatus: () => {}
  });
  const first = view.saveMovieWithAction("draft");
  await view.saveMovieWithAction("draft");
  assert.equal(calls.filter(([path]) => path === "/api/movies").length, 1);
  release({ id: "filme-qa", title: "Filme QA" });
  await first;
  assert.equal(state.savingMovie, false);
  assert.equal(state.selectedMovieId, "filme-qa");
  assert.equal(calls.filter(([path]) => path === "/api/movies/order").length, 1);
});
