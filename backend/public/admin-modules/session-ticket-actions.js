((root) => {
  function createSessionTicketActionHandler({ openSessionDashboardDetail, showSessionTickets, openSessionEditor, removeSession, openGlobalSessionEditor, copyTicketCode, openOrderView }) {
    return (event) => {
      const sessionAction = event.target.closest?.("[data-admin-session-action][data-admin-session-id]");
      if (sessionAction) {
        const sessionId = sessionAction.dataset.adminSessionId;
        const movieId = sessionAction.dataset.adminMovieId;
        if (sessionAction.dataset.adminSessionAction === "dashboard") openSessionDashboardDetail(movieId, sessionId);
        else if (sessionAction.dataset.adminSessionAction === "tickets") showSessionTickets(sessionId);
        else if (sessionAction.dataset.adminSessionAction === "edit") openSessionEditor(sessionId);
        else if (sessionAction.dataset.adminSessionAction === "remove") removeSession(sessionId);
        else if (sessionAction.dataset.adminSessionAction === "global-edit") openGlobalSessionEditor(movieId, sessionId);
        return true;
      }
      const ticketAction = event.target.closest?.("[data-admin-ticket-action][data-admin-ticket-value]");
      if (ticketAction) {
        if (ticketAction.dataset.adminTicketAction === "copy") void copyTicketCode(ticketAction.dataset.adminTicketValue);
        else if (ticketAction.dataset.adminTicketAction === "order") openOrderView(ticketAction.dataset.adminTicketValue);
        return true;
      }
      return false;
    };
  }

  const api = Object.freeze({ createSessionTicketActionHandler });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.sessionTicketActions = api;
  }
})(globalThis);
