((root) => {
  function bindCatalogAndRoomEvents({
    $, addRoomSeatType, cancelCreation, clearSessionAutocorrectPreview, closeSessionEditor, deleteMovie,
    deleteRoom, generateRoomSeatMap, handleRoomSeatSelectionAction, loadSessionSeatMap, movieFormSnapshot, newMovie,
    newRoom, openGlobalSessionEditor, openSessionEditor, previewSessionAutocorrect, removeRoomSeatType, renderMovieCatalogPositionPreview,
    renderMovieMediaPreview, renderRoomSeatEditor, renderRoomSeatMap, saveMovie, saveMovieWithAction, saveRoom,
    saveSession, searchTmdb, selectRoomSeatElement, setAdminSubtab, setMovieWizardStep, slugify,
    state, syncSessionCreationMode, updateGlobalSessionFilters, updateRoomSeatSelectionField, updateSessionScheduleSuggestion, uploadMovieImage,
    validateMovieWizardStep
  }) {
    $("newMovieButton").addEventListener("click", newMovie);
    $("cancelMovieCreateButton").addEventListener("click", () => cancelCreation("movie"));
    $("movieForm").addEventListener("submit", saveMovie);
    $("deleteMovieButton").addEventListener("click", () => deleteMovie());
    $("addSessionButton").addEventListener("click", () => openSessionEditor());
    $("sessionEditor").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("input, select")) {
        event.preventDefault();
        void saveSession();
      }
    });
    window.addEventListener("beforeunload", (event) => {
      if (state.movieFormSnapshot && state.movieFormSnapshot !== movieFormSnapshot()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    $("sessionCreationMode").addEventListener("change", syncSessionCreationMode);
    $("sessionDate").addEventListener("change", () => {
      if (state.editingSessionId) {
        state.editingSessionDateChanged = $("sessionDate").value !== state.editingSessionOriginalDate;
      }
      if ($("sessionCreationMode").value === "range" && (!$("sessionDateEnd").value || $("sessionDateEnd").value < $("sessionDate").value)) {
        $("sessionDateEnd").value = $("sessionDate").value;
      }
      updateSessionScheduleSuggestion({ apply: !state.sessionTimeManuallyEdited });
    });
    $("sessionRoom").addEventListener("change", () => updateSessionScheduleSuggestion({ apply: !state.sessionTimeManuallyEdited }));
    $("sessionUseSuggestedTime").addEventListener("click", () => {
      $("sessionTime").value = $("sessionUseSuggestedTime").dataset.suggestedTime || "";
      state.sessionTimeManuallyEdited = false;
      updateSessionScheduleSuggestion();
      $("sessionTime").focus();
    });
    $("sessionTime").addEventListener("input", () => {
      state.sessionTimeManuallyEdited = true;
      updateSessionScheduleSuggestion();
    });
    $("saveSessionButton").addEventListener("click", saveSession);
    $("cancelSessionButton").addEventListener("click", closeSessionEditor);
    $("tmdbSearchButton").addEventListener("click", searchTmdb);
    $("movieWizardBack").addEventListener("click", () => setMovieWizardStep(state.movieWizardStep - 1));
    $("movieWizardNext").addEventListener("click", () => {
      if (validateMovieWizardStep(state.movieWizardStep)) setMovieWizardStep(state.movieWizardStep + 1);
    });
    $("movieDraftButton").addEventListener("click", () => saveMovieWithAction("draft"));
    document.querySelectorAll("[data-movie-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetStep = Number(button.dataset.movieStep);
        if (targetStep <= state.movieWizardStep || validateMovieWizardStep(state.movieWizardStep)) setMovieWizardStep(targetStep);
      });
    });
    $("movieTitle").addEventListener("input", () => {
      if (!$("movieId").value && !$("movieSlug").dataset.touched) $("movieSlug").value = slugify($("movieTitle").value);
      renderMovieCatalogPositionPreview();
    });
    $("movieCatalogPosition").addEventListener("change", renderMovieCatalogPositionPreview);
    $("movieSlug").addEventListener("input", () => {
      $("movieSlug").dataset.touched = "true";
      $("movieSlug").value = slugify($("movieSlug").value);
    });
    $("moviePosterUpload").addEventListener("change", () => uploadMovieImage("moviePosterUpload", "moviePosterUrl", "moviePosterPreview", "movies/posters"));
    $("movieBackdropUpload").addEventListener("change", () => uploadMovieImage("movieBackdropUpload", "movieBackdropUrl", "movieBackdropPreview", "movies/backdrops"));
    $("moviePosterUrl").addEventListener("input", () => renderMovieMediaPreview("moviePosterUrl", "moviePosterPreview", "Prévia do pôster"));
    $("movieBackdropUrl").addEventListener("input", () => renderMovieMediaPreview("movieBackdropUrl", "movieBackdropPreview", "Prévia do banner"));
    $("tmdbQuery").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchTmdb();
      }
    });

    $("newRoomButton").addEventListener("click", () => {
      setAdminSubtab("rooms", "registered");
      newRoom();
    });
    ["globalSessionsFrom", "globalSessionsTo", "globalSessionsRoom", "globalSessionsMovie", "globalSessionsStatus", "globalSessionsConflictsOnly"].forEach((id) => {
      $(id)?.addEventListener("change", updateGlobalSessionFilters);
    });
    $("globalSessionCreateButton")?.addEventListener("click", () => openGlobalSessionEditor($("globalSessionCreateMovie").value));
    $("sessionSeatRefresh")?.addEventListener("click", () => void loadSessionSeatMap());
    $("sessionSeatClose")?.addEventListener("click", () => $("sessionSeatDialog").close());
    $("sessionSeatDialog")?.addEventListener("close", () => { state.sessionSeatView = null; });
    $("sessionSeatDialog")?.addEventListener("click", (event) => {
      if (event.target === $("sessionSeatDialog")) $("sessionSeatDialog").close();
    });
    $("sessionAutocorrectPreviewButton")?.addEventListener("click", previewSessionAutocorrect);
    ["sessionAutocorrectTurnaround", "sessionAutocorrectStep", "sessionAutocorrectIncludeSales"].forEach((id) => $(id)?.addEventListener("change", clearSessionAutocorrectPreview));
    $("cancelRoomCreateButton").addEventListener("click", () => cancelCreation("room"));
    $("roomForm").addEventListener("submit", saveRoom);
    $("deleteRoomButton").addEventListener("click", deleteRoom);
    $("roomSeatSelectionEnabled").addEventListener("change", (event) => {
      state.roomSeatDraft.enabled = event.target.checked;
      renderRoomSeatEditor();
    });
    $("generateRoomSeatsButton").addEventListener("click", generateRoomSeatMap);
    $("addRoomSeatTypeButton").addEventListener("click", addRoomSeatType);
    $("roomSeatScreenLabel").addEventListener("input", (event) => {
      state.roomSeatDraft.screenLabel = event.target.value;
      $("roomSeatScreen").textContent = event.target.value || "TELA";
    });
    $("roomSeatTypes").addEventListener("input", (event) => {
      const row = event.target.closest("[data-seat-type-id]");
      const field = event.target.dataset.seatTypeField;
      const type = state.roomSeatDraft.seatTypes.find((candidate) => candidate.id === row?.dataset.seatTypeId);
      if (!type || !field) return;
      type[field] = event.target.value;
      renderRoomSeatMap();
    });
    $("roomSeatTypes").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-seat-type]");
      if (button) removeRoomSeatType(button.dataset.removeSeatType);
    });
    $("roomSeatMap").addEventListener("click", (event) => {
      const seatButton = event.target.closest("[data-room-seat-id]");
      if (seatButton) return selectRoomSeatElement({ kind: "seat", seatId: seatButton.dataset.roomSeatId });
      const rowButton = event.target.closest("[data-room-seat-row-id]");
      if (rowButton) return selectRoomSeatElement({ kind: "row", rowId: rowButton.dataset.roomSeatRowId });
      const columnButton = event.target.closest("[data-room-seat-column]");
      if (columnButton) selectRoomSeatElement({ kind: "column", columnIndex: Number(columnButton.dataset.roomSeatColumn) });
    });
    $("roomSeatSelectionPanel").addEventListener("input", (event) => {
      const field = event.target.dataset.seatSelectionField;
      if (!field) return;
      updateRoomSeatSelectionField(field, event.target.type === "checkbox" ? event.target.checked : event.target.value);
    });
    $("roomSeatSelectionPanel").addEventListener("click", (event) => {
      const accessibilityButton = event.target.closest("[data-seat-accessibility]");
      if (accessibilityButton) return updateRoomSeatSelectionField("accessibility", accessibilityButton.dataset.seatAccessibility || "");
      const button = event.target.closest("[data-seat-selection-action]");
      if (button) handleRoomSeatSelectionAction(button.dataset.seatSelectionAction);
    });
  }
  const api = Object.freeze({ bindCatalogAndRoomEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindCatalogAndRoomEvents = api; }
})(globalThis);
