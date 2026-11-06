((root) => {
  function createMovieCatalogView({ state, $, document, escapeHtml, slugify, publicMovieStatusLabel, setDisabled, showToast, paginateAdminItems, creationPlaceholder, currentMovie, renderAdminListPager, moviePriorityState, workflowStatusLabel, adminAssetUrl, syncCreationControl, renderMovieMediaPreview, populateMovieCatalogPositions, renderSessions, closeSessionEditor, getMoviePayload, confirm }) {
    function renderMoviePublishSummary() {
      const target = $("moviePublishSummary");
      if (!target) return;
      const sessions = state.movieDraftSessions || [];
      target.innerHTML = `
        <div><span>Título</span><strong>${escapeHtml($("movieTitle").value || "Sem título")}</strong></div>
        <div><span>Página</span><strong>/filmes/${escapeHtml($("movieSlug").value || slugify($("movieTitle").value) || "novo-filme")}</strong></div>
        <div><span>Status no site</span><strong>${publicMovieStatusLabel($("movieStatus").value)}</strong></div>
        <div><span>Posição no catálogo</span><strong>${escapeHtml($("movieCatalogPosition").value || "1")} de ${$("movieCatalogPosition").options.length || 1}</strong></div>
        <div><span>Sessões cadastradas</span><strong>${sessions.length}</strong></div>
        <div><span>Destaque da home</span><strong>${$("movieHighlight").checked ? "Sim" : "Não"}</strong></div>
      `;
    }

    function setMovieWizardStep(step) {
      const nextStep = Math.max(0, Math.min(4, Number(step || 0)));
      state.movieWizardStep = nextStep;
      document.querySelectorAll("[data-movie-step]").forEach((button) => {
        const buttonStep = Number(button.dataset.movieStep);
        button.classList.toggle("active", buttonStep === nextStep);
        button.classList.toggle("done", buttonStep < nextStep);
      });
      document.querySelectorAll("[data-movie-step-panel]").forEach((panel) => {
        panel.classList.toggle("active", Number(panel.dataset.movieStepPanel) === nextStep);
      });
      setDisabled("movieWizardBack", nextStep === 0);
      $("movieWizardNext").hidden = nextStep === 4;
      $("moviePublishButton").hidden = nextStep !== 4;
      if (nextStep === 4) renderMoviePublishSummary();
    }

    function validateMovieWizardStep(step, finalPublish = false) {
      if (step >= 0 && !$("movieTitle").value.trim()) {
        showToast("Informe o título do filme.", "error");
        setMovieWizardStep(0);
        $("movieTitle").focus();
        return false;
      }
      if (step >= 0 && !$("movieSlug").value.trim()) {
        $("movieSlug").value = slugify($("movieTitle").value);
      }
      if (!finalPublish) return true;
      if (!$("movieDuration").value.trim()) {
        showToast("Informe a duração do filme antes de publicar.", "error");
        setMovieWizardStep(1);
        $("movieDuration").focus();
        return false;
      }
      if (!$("moviePosterUrl").value.trim()) {
        showToast("Adicione um pôster antes de publicar.", "error");
        setMovieWizardStep(2);
        return false;
      }
      return true;
    }

    function renderMovies(options = {}) {
      const catalog = [...(state.content?.movies || [])].sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
      const catalogPositions = new Map(catalog.map((movie, index) => [movie.id, index + 1]));
      const search = ($("movieCatalogSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
      const filter = $("movieCatalogFilter")?.value || "";
      const movies = catalog.filter((movie) => {
        const workflow = movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published");
        const matches = !filter || (filter === "draft" ? workflow === "draft"
          : filter === "archived" ? workflow === "archived" || (workflow !== "draft" && movie.status === "hidden")
          : workflow === "published" && movie.status === filter);
        return matches && String(movie.title || "").toLocaleLowerCase("pt-BR").includes(search);
      });
      if (state.creating.movie) {
        $("moviesList").innerHTML = creationPlaceholder("Novo filme em edição", "Preencha o quadro à direita e publique quando estiver pronto.");
        if (!options.preserveForm) fillMovieForm(null);
        return;
      }
      if (!movies.length) {
        $("moviesList").innerHTML = `
          <div class="empty-state">
            <strong>${catalog.length ? "Nenhum filme encontrado" : "Nenhum filme cadastrado"}</strong>
            <span>${catalog.length ? "Altere a busca ou o filtro de situação." : "Use Novo Filme ou a busca TMDB para montar o catálogo."}</span>
          </div>
        `;
        if (!options.preserveForm) fillMovieForm(currentMovie());
        return;
      }
    
      const pagination = paginateAdminItems(movies, "movies", options.preserveForm ? "" : "selectedMovieId");
      $("moviesList").innerHTML = pagination.pageItems
        .map((movie) => {
          const sessionCount = movie.sessions?.length || 0;
          const active = movie.id === state.selectedMovieId ? "active" : "";
          const statusLabel = publicMovieStatusLabel(movie.status);
          const priorityState = moviePriorityState(movie);
          const workflowLabel = workflowStatusLabel(movie.workflowStatus);
          const release = movie.releaseDate ? ` • estreia ${new Date(`${movie.releaseDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
          const automation = movie.autoPublish ? " • auto" : "";
          const updated = movie.updatedAt ? ` • atualizado ${new Date(movie.updatedAt).toLocaleDateString("pt-BR")}` : "";
          return `
            <div class="movie-row ${active}" draggable="true" data-movie-id="${escapeHtml(movie.id)}">
              <button class="drag-handle" type="button" draggable="true" aria-label="Arrastar para mudar prioridade" title="Arrastar para mudar prioridade">↕</button>
              <div class="movie-thumb">${movie.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(movie.posterUrl))}" alt="">` : `<span>${escapeHtml(movie.rating || "L")}</span>`}</div>
              <div>
                <span class="list-title">${escapeHtml(movie.title)}</span>
                <span class="movie-status-pill ${escapeHtml(priorityState.className)}"><span></span>${escapeHtml(priorityState.label)}</span>
                <span class="list-meta">Posição ${catalogPositions.get(movie.id)} • ${workflowLabel} • ${statusLabel} • ${sessionCount} sessões • ${escapeHtml(movie.duration || "-")} • ${escapeHtml(movie.rating || "L")}${release}${automation}${movie.isHighlight ? " • destaque" : ""}${updated}</span>
              </div>
              <div class="movie-row-actions">
                <button class="icon-button" type="button" data-movie-action="menu" aria-label="Ações do filme">•••</button>
                <div id="movieMenu-${escapeHtml(movie.id)}" class="context-menu-popover" hidden>
                  <button type="button" data-movie-action="duplicate">Duplicar</button>
                  <button type="button" data-movie-action="move-up">Mover para cima</button>
                  <button type="button" data-movie-action="move-down">Mover para baixo</button>
                  <button type="button" data-movie-action="archive">Arquivar</button>
                  <button class="danger-text" type="button" data-movie-action="delete">Excluir</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("") + renderAdminListPager("movies", pagination, "filme(s)");
    
      if (!options.preserveForm) fillMovieForm(currentMovie());
    }

    function fillMovieForm(movie) {
      syncCreationControl("movie", "cancelMovieCreateButton", "deleteMovieButton", Boolean(movie));
      setDisabled("deleteMovieButton", !movie);
      setDisabled("addSessionButton", false);
      $("addSessionButtonLabel").textContent = movie ? "Adicionar sessão" : "Salvar rascunho e adicionar sessão";
      $("movieFormHint").textContent = movie ? `Editando ${movie.title}` : "Novo filme";
      $("movieId").value = movie?.id || "";
      $("movieWorkflowStatus").value = movie?.workflowStatus || "draft";
      $("movieTitle").value = movie?.title || "";
      $("movieOriginalTitle").value = movie?.originalTitle || "";
      $("movieSlug").value = movie?.slug || movie?.id || "";
      $("movieSlug").dataset.touched = movie ? "true" : "";
      $("movieStatus").value = movie?.status || "now_playing";
      $("movieRating").value = movie?.rating || "L";
      $("movieReleaseDate").value = movie?.releaseDate || "";
      $("movieAutoPublish").checked = Boolean(movie?.autoPublish);
      $("movieDuration").value = movie?.duration || "";
      state.movieDraftMetadata = structuredClone(movie?.metadata || {});
      $("movieDirector").value = movie?.director || "";
      $("movieTag").value = movie?.tag ?? "";
      populateMovieCatalogPositions(movie);
      $("movieGenre").value = (movie?.genre || []).join(", ");
      $("movieSynopsis").value = movie?.synopsis || "";
      $("movieTrailer").value = movie?.trailerYoutubeId || "";
      $("movieHighlight").checked = Boolean(movie?.isHighlight);
      $("moviePosterUrl").value = movie?.posterUrl || "";
      $("movieBackdropUrl").value = movie?.backdropUrl || "";
      renderMovieMediaPreview("moviePosterUrl", "moviePosterPreview", "Prévia do pôster");
      renderMovieMediaPreview("movieBackdropUrl", "movieBackdropPreview", "Prévia do banner");
      state.movieDraftSessions = (movie?.sessions || []).map((session) => ({ ...session }));
      closeSessionEditor();
      renderSessions(state.movieDraftSessions);
      setMovieWizardStep(0);
      renderTmdbMissingFields([]);
      state.movieFormSnapshot = movieFormSnapshot();
    }

    function movieFormSnapshot() {
      return JSON.stringify({ ...getMoviePayload($("movieWorkflowStatus").value), position: $("movieCatalogPosition").value });
    }

    function confirmMovieNavigation() {
      if (state.savingMovie || state.savingSession) return false;
      return !state.movieFormSnapshot || state.movieFormSnapshot === movieFormSnapshot()
        || confirm("Há alterações não salvas no filme. Descartar essas alterações?");
    }

    const TMDB_FIELD_TARGETS = {
      title: "movieTitle",
      duration: "movieDuration",
      director: "movieDirector",
      genre: "movieGenre",
      synopsis: "movieSynopsis",
      rating: "movieRating",
      posterUrl: "moviePosterUrl",
      backdropUrl: "movieBackdropUrl",
      trailerYoutubeId: "movieTrailer",
      releaseDate: "movieReleaseDate"
    };

    function renderTmdbMissingFields(fields = []) {
      const target = $("tmdbMissingFields");
      if (!target) return;
      const missingFields = Array.isArray(fields) ? fields.filter((field) => field?.field && field?.label) : [];
      target.hidden = missingFields.length === 0;
      if (!missingFields.length) {
        target.innerHTML = "";
        return;
      }
      const plural = missingFields.length === 1 ? "dado não foi coletado" : "dados não foram coletados";
      target.innerHTML = `
        <div>
          <strong>Complete ${missingFields.length} ${plural} pelo TMDB</strong>
          <p>Selecione um campo para ir direto à etapa correspondente e informá-lo manualmente.</p>
        </div>
        <div class="tmdb-missing-field-list">
          ${missingFields.map((field) => `<button class="tmdb-missing-field" type="button" data-tmdb-missing-field="${escapeHtml(field.field)}" data-tmdb-missing-step="${Number(field.step) || 0}">${escapeHtml(field.label)}</button>`).join("")}
        </div>
      `;
      target.querySelectorAll("[data-tmdb-missing-field]").forEach((button) => {
        button.addEventListener("click", () => {
          const step = Number(button.dataset.tmdbMissingStep || 0);
          const fieldId = button.dataset.tmdbMissingField;
          setMovieWizardStep(step);
          const input = $(TMDB_FIELD_TARGETS[fieldId]);
          input?.focus({ preventScroll: true });
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    }

    return { renderMoviePublishSummary, setMovieWizardStep, validateMovieWizardStep, renderMovies, fillMovieForm, movieFormSnapshot, confirmMovieNavigation, renderTmdbMissingFields };
  }

  const api = Object.freeze({ createMovieCatalogView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.movieCatalogView = api; }
})(globalThis);
