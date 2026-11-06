((root) => {
  function createMovieCatalogCommands({ state, $, document, confirm, confirmMovieNavigation, renderMovies, escapeHtml, renderMoviePublishSummary, api, setStatus, showToast, closeFloatingActionMenu, creationPlaceholder, fillMovieForm, movieFormSnapshot, currentMovie, slugify, validateMovieWizardStep, setDisabled, upsertAdminCollection, showSuccess, removeAdminCollectionItem, closeSessionEditor, renderGlobalSessions, renderInsights }) {
    function selectMovie(id) {
      if (!confirmMovieNavigation()) return;
      state.creating.movie = false;
      state.selectedMovieId = id;
      renderMovies();
    }

    function orderedMovies() {
      return [...(state.content?.movies || [])].sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
    }

    function movieCatalogNeighbors(movieId = "") {
      return orderedMovies().filter((movie) => movie.id !== movieId);
    }

    function movieCatalogPositionLabel(position, movies) {
      const above = movies[position - 2];
      const below = movies[position - 1];
      if (!above && !below) return "1 - Primeiro filme do catálogo";
      if (!above) return `1 - Primeiro, antes de ${below.title}`;
      if (!below) return `${position} - Último, depois de ${above.title}`;
      return `${position} - Entre ${above.title} e ${below.title}`;
    }

    function populateMovieCatalogPositions(movie) {
      const movies = movieCatalogNeighbors(movie?.id || "");
      const currentPosition = movie
        ? orderedMovies().findIndex((item) => item.id === movie.id) + 1
        : movies.length + 1;
      $("movieCatalogPosition").innerHTML = Array.from({ length: movies.length + 1 }, (_, index) => {
        const position = index + 1;
        return `<option value="${position}">${escapeHtml(movieCatalogPositionLabel(position, movies))}</option>`;
      }).join("");
      $("movieCatalogPosition").value = String(Math.max(1, currentPosition));
      renderMovieCatalogPositionPreview();
    }

    function renderMovieCatalogPositionPreview() {
      const movieId = $("movieId").value || state.selectedMovieId || "";
      const movies = movieCatalogNeighbors(movieId);
      const position = Math.min(Math.max(1, Number($("movieCatalogPosition").value || 1)), movies.length + 1);
      const above = movies[position - 2];
      const below = movies[position - 1];
      const currentTitle = $("movieTitle").value.trim() || "Novo filme";
      $("movieCatalogPositionPreview").innerHTML = `
        <div><span>Imediatamente acima</span><strong>${escapeHtml(above?.title || "Nenhum filme")}</strong></div>
        <div class="current"><span>Posição ${position} de ${movies.length + 1}</span><strong>${escapeHtml(currentTitle)}</strong></div>
        <div><span>Imediatamente abaixo</span><strong>${escapeHtml(below?.title || "Nenhum filme")}</strong></div>
      `;
      if (state.movieWizardStep === 4) renderMoviePublishSummary();
    }

    function loweredMoviePriorityMessage(changes) {
      if (!changes.length) return "Nenhum outro filme perdeu prioridade.";
      const visible = changes.slice(0, 3).map((change) => `${change.title}: posição ${change.from} → ${change.to}`);
      const remaining = changes.length - visible.length;
      return `${visible.join("; ")}${remaining > 0 ? `; e mais ${remaining} filme(s)` : ""}.`;
    }

    async function saveMovieOrder(ids, options = {}) {
      if (!ids.length) return;
      const previousPositions = new Map(orderedMovies().map((movie, index) => [movie.id, index + 1]));
      try {
        const result = await api("/api/movies/order", {
          method: "PUT",
          body: JSON.stringify({ ids })
        });
        state.content.movies = result.movies || state.content.movies;
        const loweredMovies = orderedMovies()
          .map((movie, index) => ({
            id: movie.id,
            title: movie.title || "Filme sem título",
            from: previousPositions.get(movie.id),
            to: index + 1
          }))
          .filter((movie) => movie.from && movie.to > movie.from);
        if (options.render !== false) renderMovies({ preserveForm: true });
        setStatus("Salvo");
        if (options.notify !== false) showToast(`Prioridade atualizada. ${loweredMoviePriorityMessage(loweredMovies)}`);
        return { movies: state.content.movies, loweredMovies };
      } catch (error) {
        if (options.notify !== false) showToast(error.message, "error");
        if (options.rethrow) throw error;
      }
    }

    async function applyMovieCatalogPosition(movieId, requestedPosition) {
      const ids = orderedMovies().map((movie) => movie.id).filter((id) => id !== movieId);
      const position = Math.min(Math.max(1, Math.trunc(Number(requestedPosition) || 1)), ids.length + 1);
      ids.splice(position - 1, 0, movieId);
      const result = await saveMovieOrder(ids, { render: false, notify: false, rethrow: true });
      return { position, loweredMovies: result?.loweredMovies || [] };
    }

    function moveMovie(id, direction) {
      const ids = orderedMovies().map((movie) => movie.id);
      const index = ids.indexOf(id);
      const nextIndex = index + Number(direction || 0);
      if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
      [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
      saveMovieOrder(ids);
    }

    function handleMovieDragStart(event, id) {
      event.stopPropagation();
      event.dataTransfer?.setData("text/plain", id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      document.querySelectorAll(".movie-row").forEach((row) => {
        row.classList.toggle("dragging", row.dataset.movieId === id);
      });
    }

    function handleMovieDragOver(event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      event.target.closest?.(".movie-row")?.classList.add("drag-over");
    }

    function handleMovieDragLeave(event) {
      const row = event.target.closest?.(".movie-row");
      if (row && !row.contains(event.relatedTarget)) row.classList.remove("drag-over");
    }

    function handleMovieDragEnd() {
      document.querySelectorAll(".movie-row.drag-over, .movie-row.dragging").forEach((row) => {
        row.classList.remove("drag-over", "dragging");
      });
    }

    function handleMovieDrop(event, targetId) {
      event.preventDefault();
      event.stopPropagation();
      handleMovieDragEnd();
      const sourceId = event.dataTransfer?.getData("text/plain");
      if (!sourceId || sourceId === targetId) return;
      const ids = orderedMovies().map((movie) => movie.id);
      const from = ids.indexOf(sourceId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      saveMovieOrder(ids);
    }

    function toggleMovieMenu(movieId) {
      closeFloatingActionMenu();
      document.querySelectorAll(".context-menu-popover").forEach((menu) => {
        if (menu.id !== `movieMenu-${movieId}`) menu.hidden = true;
      });
      const menu = $(`movieMenu-${movieId}`);
      if (menu) menu.hidden = !menu.hidden;
    }

    function newMovie() {
      if (!confirmMovieNavigation()) return;
      state.creating.movie = true;
      state.selectedMovieId = "";
      $("moviesList").innerHTML = creationPlaceholder("Novo filme em edição", "Preencha o quadro à direita e publique quando estiver pronto.");
      fillMovieForm(null);
      $("movieWorkflowStatus").value = "draft";
      $("movieStatus").value = "upcoming";
      state.movieFormSnapshot = movieFormSnapshot();
    }

    function getMoviePayload(action = "published") {
      const workflowStatus = action === "draft" ? "draft" : "published";
      const status = $("movieStatus").value;
      return {
        id: $("movieId").value || $("movieSlug").value || undefined,
        slug: $("movieSlug").value || slugify($("movieTitle").value),
        workflowStatus,
        status,
        title: $("movieTitle").value,
        originalTitle: $("movieOriginalTitle").value,
        synopsis: $("movieSynopsis").value,
        duration: $("movieDuration").value,
        director: $("movieDirector").value,
        genre: $("movieGenre").value.split(",").map((item) => item.trim()).filter(Boolean),
        rating: $("movieRating").value,
        releaseDate: $("movieReleaseDate").value,
        autoPublish: $("movieAutoPublish").checked,
        posterUrl: $("moviePosterUrl").value,
        backdropUrl: $("movieBackdropUrl").value,
        trailerYoutubeId: $("movieTrailer").value,
        isHighlight: $("movieHighlight").checked,
        tag: $("movieTag").value,
        sortOrder: Number(currentMovie()?.sortOrder ?? ((orderedMovies().length + 1) * 10)),
        metadata: {
          ...(state.movieDraftMetadata || {}),
          updatedFromAdmin: true
        }
      };
    }

    async function saveMovieWithAction(action = "published", options = {}) {
      if (state.savingMovie) return;
      if (!validateMovieWizardStep(4, action === "published")) return;
      state.savingMovie = true;
      ["movieDraftButton", "moviePublishButton", "addSessionButton"].forEach((id) => setDisabled(id, true));
      try {
        const requestedPosition = Number($("movieCatalogPosition").value || 1);
        const payload = getMoviePayload(action);
        const existingId = $("movieId").value || state.selectedMovieId;
        if (existingId) payload.id = existingId;
        const saved = existingId
          ? await api(`/api/movies/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/movies", { method: "POST", body: JSON.stringify(payload) });
        state.creating.movie = false;
        state.selectedMovieId = saved.id;
        $("movieId").value = saved.id;
        upsertAdminCollection("movies", saved);
        let priorityChange;
        try {
          priorityChange = await applyMovieCatalogPosition(saved.id, requestedPosition);
        } catch (error) {
          renderMovies();
          showToast(`Filme salvo, mas a posição no catálogo não foi alterada: ${error.message}`, "error");
          return saved;
        }
        renderMovies();
        if (options.quiet) return saved;
        showToast(action === "draft" ? "Rascunho salvo." : "Filme publicado.");
        showSuccess(
          action === "draft" ? "Rascunho salvo" : "Filme publicado",
          `${saved.title} foi atualizado na posição ${priorityChange.position} do catálogo administrativo. ${loweredMoviePriorityMessage(priorityChange.loweredMovies)}`
        );
        return saved;
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        state.savingMovie = false;
        ["movieDraftButton", "moviePublishButton", "addSessionButton"].forEach((id) => setDisabled(id, false));
      }
    }

    async function saveMovie(event) {
      event.preventDefault();
      await saveMovieWithAction("published");
    }

    async function deleteMovie(id = "") {
      const movie = id ? state.content?.movies?.find((item) => item.id === id) : currentMovie();
      if (!movie || state.deletingMovieId) return;
      if (!confirm(`Excluir "${movie.title}" do catálogo e da programação?\n\nO filme deixará de aparecer nas listas. Pedidos, ingressos e registros financeiros existentes serão preservados para consulta.`)) return;
      state.deletingMovieId = movie.id;
      setDisabled("deleteMovieButton", true);
      try {
        const result = await api(`/api/movies/${encodeURIComponent(movie.id)}`, { method: "DELETE" });
        state.selectedMovieId = "";
        removeAdminCollectionItem("movies", movie.id);
        closeSessionEditor();
        state.movieDraftSessions = [];
        renderMovies();
        renderGlobalSessions();
        renderInsights();
        showToast(result.historyPreserved ? "Filme excluído do catálogo. Histórico de vendas e financeiro preservado." : "Filme excluído.");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        state.deletingMovieId = "";
        setDisabled("deleteMovieButton", !currentMovie());
      }
    }

    async function archiveMovie(id) {
      const movie = state.content?.movies?.find((item) => item.id === id);
      if (!movie) return;
      try {
        const { sessions, ...movieData } = movie;
        const saved = await api(`/api/movies/${encodeURIComponent(movie.id)}`, {
          method: "PUT",
          body: JSON.stringify({ ...movieData, workflowStatus: "archived", status: "hidden", isHighlight: false })
        });
        upsertAdminCollection("movies", saved);
        renderMovies();
        showToast("Filme arquivado.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function duplicateMovie(id) {
      const movie = state.content?.movies?.find((item) => item.id === id);
      if (!movie) return;
      const baseSlug = `${movie.slug || movie.id}-copia`;
      let slug = baseSlug;
      let suffix = 2;
      while ((state.content?.movies || []).some((item) => item.id === slug || item.slug === slug)) slug = `${baseSlug}-${suffix++}`;
      try {
        const copy = await api("/api/movies", {
          method: "POST",
          body: JSON.stringify({
            ...movie,
            id: slug,
            slug,
            title: `${movie.title} (cópia)`,
            workflowStatus: "draft",
            status: "hidden",
            isHighlight: false,
            sessions: []
          })
        });
        state.selectedMovieId = copy.id;
        upsertAdminCollection("movies", copy);
        renderMovies();
        showToast("Cópia criada como rascunho.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { selectMovie, orderedMovies, movieCatalogNeighbors, movieCatalogPositionLabel, populateMovieCatalogPositions, renderMovieCatalogPositionPreview, loweredMoviePriorityMessage, saveMovieOrder, applyMovieCatalogPosition, moveMovie, handleMovieDragStart, handleMovieDragOver, handleMovieDragLeave, handleMovieDragEnd, handleMovieDrop, toggleMovieMenu, newMovie, getMoviePayload, saveMovieWithAction, saveMovie, deleteMovie, archiveMovie, duplicateMovie };
  }

  const api = Object.freeze({ createMovieCatalogCommands });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.movieCatalogCommands = api; }
})(globalThis);
