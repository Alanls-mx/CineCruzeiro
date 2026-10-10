((root) => {
  function bindMovieCatalogEvents({ $, state, renderMovies, toggleMovieMenu, duplicateMovie, moveMovie, archiveMovie, deleteMovie, selectMovie, handleMovieDragStart, handleMovieDragOver, handleMovieDragLeave, handleMovieDragEnd, handleMovieDrop }) {
    const filterCatalog = () => { state.moviesPage = 1; renderMovies({ preserveForm: true }); };
    $("movieCatalogSearch")?.addEventListener("input", filterCatalog);
    $("movieCatalogFilter")?.addEventListener("change", filterCatalog);
    const moviesList = $("moviesList");
    moviesList?.addEventListener("click", (event) => {
      const row = event.target.closest?.(".movie-row[data-movie-id]");
      if (!row) return;
      const id = row.dataset.movieId;
      const action = event.target.closest?.("[data-movie-action]")?.dataset.movieAction;
      if (event.target.closest?.(".movie-row-actions")) {
        event.stopPropagation();
        if (action === "menu") toggleMovieMenu(id);
        else if (action === "duplicate") duplicateMovie(id);
        else if (action === "move-up") moveMovie(id, -1);
        else if (action === "move-down") moveMovie(id, 1);
        else if (action === "archive") archiveMovie(id);
        else if (action === "delete") deleteMovie(id);
        return;
      }
      if (event.target.closest?.(".drag-handle")) return;
      selectMovie(id);
    });
    moviesList?.addEventListener("dragstart", (event) => {
      const row = event.target.closest?.(".movie-row[data-movie-id]");
      if (row) handleMovieDragStart(event, row.dataset.movieId);
    });
    moviesList?.addEventListener("dragover", (event) => {
      if (event.target.closest?.(".movie-row")) handleMovieDragOver(event);
    });
    moviesList?.addEventListener("dragleave", (event) => {
      if (event.target.closest?.(".movie-row")) handleMovieDragLeave(event);
    });
    moviesList?.addEventListener("dragend", handleMovieDragEnd);
    moviesList?.addEventListener("drop", (event) => {
      const row = event.target.closest?.(".movie-row[data-movie-id]");
      if (row) handleMovieDrop(event, row.dataset.movieId);
    });
  }

  const api = Object.freeze({ bindMovieCatalogEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.movieCatalogEvents = api;
  }
})(globalThis);
