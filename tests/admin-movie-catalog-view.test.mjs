import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createMovieCatalogView } = require("../backend/public/admin-modules/movie-catalog-view.js");

test("catalog filters and repeated rendering preserve the active form", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "" });
    return elements.get(id);
  };
  const state = { selectedMovieId: "one", creating: { movie: false }, content: { movies: [
    { id: "one", title: "Aventura", status: "now_playing", workflowStatus: "published", sortOrder: 10 },
    { id: "two", title: "Comédia", status: "upcoming", workflowStatus: "published", sortOrder: 20 }
  ] } };
  let pageItems = 0;
  const view = createMovieCatalogView({ state, $,
    escapeHtml: String, publicMovieStatusLabel: (status) => status,
    workflowStatusLabel: (status) => status, moviePriorityState: () => ({ label: "Normal", className: "normal" }),
    adminAssetUrl: String, currentMovie: () => state.content.movies[0],
    paginateAdminItems: (items) => { pageItems = items.length; return { pageItems: items }; },
    renderAdminListPager: () => ""
  });
  $("movieTitle").value = "Rascunho ainda não salvo";
  $("movieCatalogSearch").value = "comédia";
  view.renderMovies({ preserveForm: true });
  view.renderMovies({ preserveForm: true });
  assert.equal(pageItems, 1);
  assert.match($("moviesList").innerHTML, /Comédia/);
  assert.doesNotMatch($("moviesList").innerHTML, /Aventura/);
  assert.equal($("movieTitle").value, "Rascunho ainda não salvo");
});
