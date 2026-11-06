((root) => {
  function createTicketValidationController({ state, $, api, document, navigator, escapeHtml, showToast, loadContent, setQrReaderActive, startQrReader }) {
    function validationSessionOptions() {
      const today = state.content?.calendar?.today || new Date().toLocaleDateString("sv-SE");
      return (state.content?.movies || [])
        .flatMap((movie) => (movie.sessions || []).map((session) => ({
          ...session,
          movieId: movie.id,
          movieTitle: movie.title || "Filme"
        })))
        .filter((session) => session.id && session.date >= today && !["cancelled", "hidden", "archived"].includes(String(session.status || "").toLowerCase()))
        .sort((a, b) => String(`${a.date} ${a.time} ${a.movieTitle}`).localeCompare(String(`${b.date} ${b.time} ${b.movieTitle}`)));
    }

    function validationSessionLabel(session = {}) {
      const date = session.date
        ? new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
        : "Sem data";
      return `${date} • ${session.time || "--:--"} • ${session.movieTitle || "Filme"}${session.format ? ` • ${session.format}` : ""}`;
    }

    function renderValidationSessionScope() {
      const lock = $("ticketValidationSessionLock");
      const field = $("ticketValidationSessionField");
      const select = $("ticketValidationSessionSelect");
      const hint = $("ticketValidationSessionHint");
      if (!lock || !field || !select || !hint) return;

      const sessions = validationSessionOptions();
      if (!sessions.some((session) => session.id === state.validationSessionId)) {
        state.validationSessionId = sessions[0]?.id || "";
      }
      if (!sessions.length) state.validationSessionLock = false;

      lock.checked = state.validationSessionLock;
      lock.disabled = sessions.length === 0;
      field.hidden = !state.validationSessionLock;
      select.disabled = !state.validationSessionLock || sessions.length === 0;
      select.innerHTML = sessions.length
        ? sessions.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(validationSessionLabel(session))}</option>`).join("")
        : `<option value="">Nenhuma sessão futura disponível</option>`;
      if (state.validationSessionId) select.value = state.validationSessionId;

      const selected = sessions.find((session) => session.id === state.validationSessionId);
      hint.classList.toggle("locked", state.validationSessionLock && Boolean(selected));
      hint.textContent = state.validationSessionLock && selected
        ? `Proteção ativa: somente ${validationSessionLabel(selected)}.`
        : sessions.length
          ? "O leitor aceitará ingressos de qualquer sessão válida."
          : "Não há sessões futuras disponíveis para restringir o leitor.";
    }

    function updateValidationSessionLock() {
      state.validationSessionLock = Boolean($("ticketValidationSessionLock")?.checked);
      if (state.validationSessionLock && !state.validationSessionId) {
        state.validationSessionId = validationSessionOptions()[0]?.id || "";
      }
      renderValidationSessionScope();
      $("ticketValidationResult").className = "validation-result scanner-ready";
      $("ticketValidationResult").textContent = state.validationSessionLock
        ? "Filtro de sessão ativado. Ingressos de outras sessões serão recusados sem serem utilizados."
        : "Filtro removido. O leitor aceita qualquer sessão válida.";
    }

    function setTicketValidationMode(mode) {
      state.validationMode = mode === "concessions" ? "concessions" : "entry";
      state.qrPendingEntryCode = "";
      state.qrPendingConcessionCode = "";
      const concessionsMode = state.validationMode === "concessions";
      const scope = document.querySelector(".validation-scope");
      if (scope) scope.hidden = concessionsMode;
      const validateButton = $("validateTicketButton");
      if (validateButton) validateButton.textContent = concessionsMode ? "Conferir pedido" : "Conferir ingresso";
      const manualLabel = $("manualCodeLabelText");
      if (manualLabel) manualLabel.textContent = concessionsMode ? "Código do pedido ou ingresso" : "Código do ingresso";
      const instruction = $("scannerInstructionText");
      if (instruction) {
        instruction.textContent = concessionsMode
          ? "Aponte a câmera para o QR Code do pedido ou ingresso para retirar os itens da bomboniere."
          : "Aponte a câmera para o QR Code do ingresso. A validação acontece no servidor.";
      }
      const placeholderSubtitle = $("qrPlaceholderSubtitle");
      if (placeholderSubtitle) {
        placeholderSubtitle.textContent = concessionsMode
          ? "A câmera abrirá aqui para conferir a retirada dos itens da bomboniere."
          : "A câmera traseira abrirá aqui para validar o ingresso com segurança.";
      }
      const result = $("ticketValidationResult");
      if (result) {
        result.className = "validation-result scanner-ready";
        result.textContent = concessionsMode
          ? "Leitor pronto para conferir e entregar os itens da bomboniere."
          : "Leitor pronto para validar a entrada.";
      }
    }

    function ticketResultDetails(ticket = {}) {
      return [
        ticket.movieTitle || "Ingresso Cine Cruzeiro",
        [ticket.sessionTime, ticket.sessionRoom || "Sala Cruzeiro"].filter(Boolean).join(" • "),
        [ticket.ticketType, ticket.sessionFormat].filter(Boolean).join(" • ")
      ].filter(Boolean);
    }

    function renderTicketValidationResult(type, payload = {}) {
      const target = $("ticketValidationResult");
      if (!target) return;
      const ticket = payload.ticket || {};
      const details = ticketResultDetails(ticket);
      const usedAt = ticket.usedAt ? new Date(ticket.usedAt).toLocaleString("pt-BR") : "";
      const operator = ticket.usedBy ? `por ${escapeHtml(ticket.usedBy)}` : "";
      const message = escapeHtml(payload.message || "");
      const templates = {
        ok: {
          title: "Ingresso válido",
          copy: "Entrada liberada",
          action: "Escanear próximo"
        },
        used: {
          title: "Ingresso já utilizado",
          copy: [usedAt ? `Validado em ${usedAt}` : "", operator].filter(Boolean).join("<br>") || "Este código já deu entrada.",
          action: "Escanear próximo"
        },
        expired: {
          title: "Sessão indisponível",
          copy: message || "Este ingresso está expirado, cancelado ou fora da janela de validação.",
          action: "Tentar novamente"
        },
        wrongSession: {
          title: "Ingresso de outra sessão",
          copy: message || "Este ingresso não pertence à sessão escolhida e não foi utilizado.",
          action: "Escanear próximo"
        },
        invalid: {
          title: "Ingresso inválido",
          copy: message || "Código não reconhecido, cancelado ou sem autorização.",
          action: "Tentar novamente"
        },
        offline: {
          title: "Sem conexão",
          copy: "Não foi possível validar este ingresso com segurança.",
          action: "Tentar novamente"
        },
        concessionsOk: {
          title: "Itens liberados",
          copy: "Preparo e entrega registrados pelo operador.",
          action: "Escanear próximo"
        },
        concessionsPending: {
          title: "Confira o pedido",
          copy: "Marque cada item depois de confirmar que ele entrou em preparo. A baixa só acontece na confirmação final.",
          action: "Confirmar preparo e entrega"
        },
        entryPending: {
          title: "Confira o ingresso",
          copy: "Verifique os dados da sessão e libere a entrada somente depois de confirmar o ingresso com o cliente.",
          action: "Liberar entrada"
        },
        concessionsUsed: {
          title: "Itens já entregues",
          copy: message || "A bomboniere deste pedido já foi retirada.",
          action: "Escanear próximo"
        },
        withoutConcessions: {
          title: "Pedido sem bomboniere",
          copy: message || "Este pedido não possui produtos para retirada.",
          action: "Escanear próximo"
        }
      };
      const template = templates[type] || templates.invalid;
      const concessions = Array.isArray(payload.concessions) ? payload.concessions : [];
      const pendingConcessionConfirmation = type === "concessionsPending";
      const pendingEntryConfirmation = type === "entryPending";
      const detailsMarkup = details.length ? `<div class="scanner-result-details">${details.map(escapeHtml).join("<br>")}</div>` : "";
      const itemsMarkup = concessions.length ? `<div class="scanner-result-items">${concessions.map((item, index) => pendingConcessionConfirmation
        ? `<label><input type="checkbox" data-concession-confirmation="${index}" /><span><b>${Number(item.quantity || 0)}x</b> ${escapeHtml(item.name || item.id || "Item")} <small>está sendo preparado</small></span></label>`
        : `<span><b>${Number(item.quantity || 0)}x</b> ${escapeHtml(item.name || item.id || "Item")}</span>`).join("")}</div>` : "";
      const priorityMarkup = pendingConcessionConfirmation
        ? `<section class="scanner-order-priority"><span class="scanner-result-label">Itens do pedido</span>${itemsMarkup}</section>
           <div class="scanner-result-context"><span class="scanner-result-label">Filme e sessão vinculados</span>${detailsMarkup}</div>`
        : `${detailsMarkup}${itemsMarkup}`;
      target.className = `validation-result scanner-result ${type}`;
      target.innerHTML = `
        <strong>${escapeHtml(template.title)}</strong>
        ${priorityMarkup}
        <p>${template.copy}</p>
        ${pendingConcessionConfirmation
          ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmConcessionFulfillmentButton" type="button" disabled>${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" data-admin-command="scan-next-ticket">Cancelar e ler outro QR</button></div>`
          : pendingEntryConfirmation
            ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmTicketEntryButton" type="button">${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" data-admin-command="scan-next-ticket">Cancelar e ler outro QR</button></div>`
          : `<button class="primary-button full" type="button" data-admin-command="scan-next-ticket">${escapeHtml(template.action)}</button>`}
      `;
      if (pendingConcessionConfirmation) {
        const checkboxes = [...target.querySelectorAll("[data-concession-confirmation]")];
        const confirmButton = target.querySelector("#confirmConcessionFulfillmentButton");
        const updateConfirmation = () => {
          confirmButton.disabled = !checkboxes.length || checkboxes.some((checkbox) => !checkbox.checked);
        };
        checkboxes.forEach((checkbox) => checkbox.addEventListener("change", updateConfirmation));
        confirmButton.addEventListener("click", () => confirmTicketConcessions(payload.code));
      } else if (pendingEntryConfirmation) {
        target.querySelector("#confirmTicketEntryButton")?.addEventListener("click", () => confirmTicketEntry(payload.code));
      }
    }

    async function validateTicketByCode(code, options = {}) {
      const cleanCode = String(code || $("ticketValidationCode").value || "").trim();
      if (!cleanCode) {
        showToast("Informe ou leia um QR Code.", "error");
        return;
      }
      if (state.qrValidationLocked) return;
      state.qrValidationLocked = true;
      clearTimeout(state.qrAutoRestartTimer);
      setQrReaderActive(false, "Validando no servidor...");

      try {
        const sessionId = state.validationMode === "entry" && state.validationSessionLock ? state.validationSessionId : "";
        if (state.validationMode === "entry" && state.validationSessionLock && !sessionId) {
          showToast("Escolha a sessão permitida antes de validar.", "error");
          return;
        }
        const isConcessions = state.validationMode === "concessions";
        const isConfirmation = isConcessions ? options.confirmConcessions : options.confirmEntry;
        const result = await api("/api/tickets/validate", {
          method: "POST",
          body: JSON.stringify({
            code: cleanCode,
            sessionId,
            mode: state.validationMode,
            action: isConfirmation ? "confirm" : "inspect"
          })
        });
        if (result.result === "ticket_pending_confirmation") {
          state.qrPendingEntryCode = cleanCode;
          setQrReaderActive(false, "Aguardando liberação do operador");
          renderTicketValidationResult("entryPending", {
            code: cleanCode,
            ticket: result.ticket
          });
        } else if (result.result === "concessions_pending_confirmation") {
          state.qrPendingConcessionCode = cleanCode;
          setQrReaderActive(false, "Aguardando conferência dos itens");
          renderTicketValidationResult("concessionsPending", {
            code: cleanCode,
            ticket: result.ticket,
            concessions: result.concessions
          });
        } else {
          state.qrPendingEntryCode = "";
          state.qrPendingConcessionCode = "";
          setQrReaderActive(
            false,
            result.result === "concessions_fulfilled" ? "Retirada confirmada" : "Entrada liberada"
          );
          renderTicketValidationResult(
            result.result === "concessions_fulfilled" ? "concessionsOk" : "ok",
            { ticket: result.ticket, concessions: result.concessions }
          );
        }
        if ($("ticketValidationCode")) $("ticketValidationCode").value = result.ticket?.code || cleanCode;
        navigator.vibrate?.(80);
        if (!result.confirmationRequired) await loadContent({ silent: true });
      } catch (error) {
        if (!navigator.onLine) {
          renderTicketValidationResult("offline");
        } else {
          const payload = error.payload || {};
          const resultType = payload.result === "concessions_already_fulfilled"
            ? "concessionsUsed"
            : payload.result === "without_concessions"
              ? "withoutConcessions"
            : payload.result === "used"
            ? "used"
            : payload.result === "wrong_session" || payload.error?.code === "TICKET_SESSION_MISMATCH"
              ? "wrongSession"
            : payload.result === "expired"
              ? "expired"
              : payload.error?.code === "TICKET_PAYMENT_PENDING"
                ? "expired"
                : payload.result === "invalid"
                  ? "invalid"
                  : /já validado|ja validado/i.test(error.message || "")
                    ? "used"
                    : /indispon|expir|sess|pago/i.test(error.message || "")
                      ? "expired"
                      : "invalid";
          renderTicketValidationResult(resultType, {
            ticket: payload.ticket,
            concessions: payload.concessions,
            message: payload.error?.message || error.message || "Não foi possível validar este ingresso."
          });
        }
      } finally {
        state.qrValidationLocked = false;
        if (options.autoRestart && !state.qrPendingEntryCode && !state.qrPendingConcessionCode) {
          state.qrAutoRestartTimer = setTimeout(() => {
            if (state.boxOfficeTab === "validateTicket" || state.concessionTab === "validateQr") startQrReader();
          }, 4200);
        }
      }
    }

    async function confirmTicketConcessions(code) {
      const cleanCode = String(code || state.qrPendingConcessionCode || "").trim();
      if (!cleanCode) {
        renderTicketValidationResult("invalid", { message: "Leia novamente o QR Code para confirmar este pedido." });
        return;
      }
      await validateTicketByCode(cleanCode, { confirmConcessions: true });
    }

    async function confirmTicketEntry(code) {
      const cleanCode = String(code || state.qrPendingEntryCode || "").trim();
      if (!cleanCode) {
        renderTicketValidationResult("invalid", { message: "Leia novamente o QR Code para liberar esta entrada." });
        return;
      }
      await validateTicketByCode(cleanCode, { confirmEntry: true });
    }

    return { validationSessionOptions, validationSessionLabel, renderValidationSessionScope, updateValidationSessionLock, setTicketValidationMode, ticketResultDetails, renderTicketValidationResult, validateTicketByCode, confirmTicketConcessions, confirmTicketEntry };
  }
  const api = Object.freeze({ createTicketValidationController });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.ticketValidationController = api; }
})(globalThis);
