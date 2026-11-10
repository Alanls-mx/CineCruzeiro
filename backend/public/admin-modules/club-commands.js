((root) => {
  function createClubCommands({ state, $, api, cleanAdminAssetUrl, clubStatusLabel, confirm, currentClubPlan, document, CSS, isOwnerAdmin, loadContent, prompt, showSuccess, showToast }) {
    const pendingActions = new Set();
    async function once(key, action, event) {
      event?.preventDefault?.();
      if (pendingActions.has(key)) return;
      pendingActions.add(key);
      try { return await action(); }
      finally { pendingActions.delete(key); }
    }

    async function saveClubPlan(event) {
      event.preventDefault();
      const existingId = $("clubPlanId").value || state.selectedClubPlanId;
      const requestedImageUrl = cleanAdminAssetUrl($("clubPlanImageUrl").value);
      const payload = {
        id: existingId || undefined,
        name: $("clubPlanName").value,
        monthlyPrice: Number($("clubPlanPrice").value || 0),
        includedTickets: Number($("clubPlanTickets").value || 0),
        ticketDiscountPercent: Number($("clubPlanTicketDiscount").value || 0),
        concessionDiscountPercent: Number($("clubPlanConcessionDiscount").value || 0),
        creditReferenceValue: $("clubPlanCreditReferenceValue").value === "" ? null : Number($("clubPlanCreditReferenceValue").value),
        creditValidityDays: $("clubPlanCreditValidityDays").value === "" ? null : Number($("clubPlanCreditValidityDays").value),
        allowCreditRollover: $("clubPlanAllowRollover").checked,
        maxAccumulatedCredits: $("clubPlanMaxAccumulatedCredits").value === "" ? null : Number($("clubPlanMaxAccumulatedCredits").value),
        gracePeriodDays: Number($("clubPlanGracePeriodDays").value || 0),
        allowPriceDifference: $("clubPlanAllowPriceDifference").checked,
        eligibleFormats: [...document.querySelectorAll("#clubPlanEligibleFormats input:checked")].map((input) => input.value),
        eligibleSessionIds: $("clubPlanEligibleSessions").value.split(",").map((item) => item.trim()).filter(Boolean),
        excludedConcessionIds: [...document.querySelectorAll("[data-club-eligible-item]:not(:checked)")].map((input) => input.dataset.clubEligibleItem),
        freeConcessionItems: [...document.querySelectorAll("[data-club-free-item]:checked")].map((input) => ({
          concessionId: input.dataset.clubFreeItem,
          quantityPerCycle: Number(document.querySelector(`[data-club-free-quantity="${CSS.escape(input.dataset.clubFreeItem)}"]`)?.value || 1)
        })),
        imageUrl: requestedImageUrl,
        displayOrder: Number($("clubPlanDisplayOrder").value || 100),
        isFeatured: $("clubPlanFeatured").checked,
        benefits: $("clubPlanBenefits").value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        active: $("clubPlanActive").checked
      };
      payload.cancellationRules = {
        allowPeriodEnd: $("clubPlanCancelAtPeriodEnd").checked,
        allowImmediateBillingEnd: $("clubPlanCancelImmediately").checked,
        preservePaidCreditsUntilCycleEnd: true
      };
      if (isOwnerAdmin()) {
        payload.accounting = {
          ticketComponentValue: $("clubPlanAccountingTickets").value === "" ? null : Number($("clubPlanAccountingTickets").value),
          benefitsComponentValue: $("clubPlanAccountingBenefits").value === "" ? null : Number($("clubPlanAccountingBenefits").value),
          ruleVersion: $("clubPlanAccountingVersion").value.trim(),
          effectiveFrom: $("clubPlanAccountingEffectiveFrom").value
        };
      }
      try {
        const saved = existingId
          ? await api(`/api/admin/subscription-plans/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/admin/subscription-plans", { method: "POST", body: JSON.stringify(payload) });
        if (isOwnerAdmin() && $("clubNfceTrigger")) {
          await api("/api/admin/goods-fiscal-settings", {
            method: "PUT",
            body: JSON.stringify({ nfceTrigger: $("clubNfceTrigger").value })
          });
        }
        state.creating.clubPlan = false;
        state.selectedClubPlanId = saved.id;
        if (requestedImageUrl && cleanAdminAssetUrl(saved.imageUrl) !== requestedImageUrl) {
          throw new Error("O plano foi salvo, mas a imagem não foi persistida. Envie o arquivo novamente.");
        }
        delete state.pendingImages.clubPlanImageUrl;
        await loadContent({ silent: true });
        showSuccess("Plano salvo", `${saved.name} foi atualizado no Clube Cine Cruzeiro.`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function deleteClubPlan() {
      const plan = currentClubPlan();
      if (!plan) return;
      if (!confirm(`Confirmar exclusão/desativação do plano ${plan.name}?`)) return;
      try {
        const result = await api(`/api/admin/subscription-plans/${encodeURIComponent(plan.id)}`, {
          method: "DELETE",
          body: JSON.stringify({})
        });
        state.selectedClubPlanId = "";
        await loadContent({ silent: true });
        showToast(result.deactivated ? "Plano desativado porque possui histórico de assinaturas." : "Plano excluído.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function assignClubSubscription(event) {
      event.preventDefault();
      try {
        await api("/api/admin/subscriptions/assign", {
          method: "POST",
          body: JSON.stringify({
            email: $("clubAssignEmail").value,
            planId: $("clubAssignPlan").value,
            status: "active"
          })
        });
        $("clubAssignEmail").value = "";
        state.clubSubscriptionsPage = 1;
        await loadContent({ silent: true });
        showSuccess("Assinatura atribuída", "O cliente já pode usar os créditos do Clube conforme o status do plano.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function updateClubSubscription(id, status) {
      if (status === "cancelled" && !confirm("Confirmar o cancelamento desta assinatura?")) return;
      try {
        await api(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        await loadContent({ silent: true });
        showSuccess("Assinatura atualizada", `Status alterado para ${clubStatusLabel(status)}.`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function deleteClubSubscription(id) {
      if (!confirm("Excluir esta assinatura cancelada do banco de dados?")) return;
      try {
        await api(`/api/admin/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadContent({ silent: true });
        showSuccess("Assinatura excluída", "A assinatura cancelada foi removida do cadastro do cliente.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function adjustClubCredit(id) {
      const deltaInput = prompt("Informe o ajuste de créditos. Use negativo para remover:");
      if (deltaInput === null) return;
      const delta = Number(deltaInput);
      if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
        showToast("Informe um número inteiro diferente de zero.", "error");
        return;
      }
      try {
        await api(`/api/admin/subscriptions/${encodeURIComponent(id)}/credits/adjust`, {
          method: "POST",
          body: JSON.stringify({ delta })
        });
        await loadContent({ silent: true });
        showSuccess("Créditos ajustados", "O saldo do cliente foi atualizado com registro no histórico da assinatura.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return {
      saveClubPlan: (event) => once("plan-save", () => saveClubPlan(event), event),
      deleteClubPlan: () => once("plan-delete", () => deleteClubPlan()),
      assignClubSubscription: (event) => once("subscription-assign", () => assignClubSubscription(event), event),
      updateClubSubscription: (id, status) => once(`subscription-${id}`, () => updateClubSubscription(id, status)),
      deleteClubSubscription: (id) => once(`subscription-${id}`, () => deleteClubSubscription(id)),
      adjustClubCredit: (id) => once(`credit-${id}`, () => adjustClubCredit(id))
    };
  }

  const api = Object.freeze({ createClubCommands });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.clubCommands = api; }
})(globalThis);
