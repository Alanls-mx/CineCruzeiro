((root) => {
  function bindAccountEvents({
    $, activatePanel, api, closeAdminDrawer, closeAdminProfileMenu, closeTwoFactorSettings,
    downloadRecoveryCodes, loadAdminUser, loadContent, loadTwoFactorStatus, logoutAdmin, openTwoFactorSettings,
    renderStaffAvatar, renderTwoFactorSettings, saveAdminSecurityPolicy, saveMyAccount, setTicketValidationMode, showSuccess,
    showToast, state, toggleAdminDrawer, toggleAdminProfileMenu, uploadProfilePhoto
  }) {
    $("adminMenuButton").addEventListener("click", () => toggleAdminDrawer());
    $("adminDrawerBackdrop").addEventListener("click", closeAdminDrawer);
    $("adminProfileButton")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAdminProfileMenu();
    });
    $("accountTwoFactorButton")?.addEventListener("click", () => void openTwoFactorSettings());
    $("myAccountTwoFactorButton")?.addEventListener("click", () => void openTwoFactorSettings());
    $("myAccountForm").addEventListener("submit", saveMyAccount);
    $("myPasswordForm").addEventListener("submit", saveMyAccount);
    ["myAccount", "user"].forEach((prefix) => {
      $(prefix + "Photo").addEventListener("change", (event) => void uploadProfilePhoto(prefix, event.target));
      $(prefix + "RemovePhoto").addEventListener("click", () => {
        $(prefix + "Picture").value = "";
        renderStaffAvatar($(prefix + "Avatar"), { name: $(prefix + "Name").value });
        $(prefix + "RemovePhoto").disabled = true;
      });
    });
    $("adminSecurityPolicyForm")?.addEventListener("submit", saveAdminSecurityPolicy);
    $("profileLogoutButton")?.addEventListener("click", logoutAdmin);
    document.querySelectorAll("[data-profile-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.profileAction === "account") {
          closeAdminProfileMenu();
          activatePanel("myAccountPanel", { scroll: true });
          return;
        }
        closeAdminProfileMenu();
        void openTwoFactorSettings();
      });
    });
    document.querySelectorAll("[data-validation-mode]").forEach((button) => {
      button.addEventListener("click", () => setTicketValidationMode(button.dataset.validationMode));
    });
    $("twoFactorCloseButton")?.addEventListener("click", closeTwoFactorSettings);
    $("twoFactorOverlay")?.addEventListener("click", (event) => {
      if (event.target === $("twoFactorOverlay")) closeTwoFactorSettings();
    });
    $("twoFactorBody")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const submitButton = form.querySelector("button[type='submit']");
      const values = Object.fromEntries(new FormData(form).entries());
      if (submitButton) submitButton.disabled = true;
      try {
        if (form.id === "twoFactorSetupForm") {
          state.twoFactorSetup = await api("/api/admin/2fa/setup", { method: "POST", body: JSON.stringify(values) });
          renderTwoFactorSettings();
          return;
        }
        if (form.id === "twoFactorEnableForm") {
          const result = await api("/api/admin/2fa/enable", { method: "POST", body: JSON.stringify(values) });
          state.twoFactorSetup = null;
          state.twoFactorRecoveryCodes = result.recoveryCodes || [];
          state.twoFactorStatus = { enabled: true, recoveryCodesRemaining: state.twoFactorRecoveryCodes.length, confirmedAt: new Date().toISOString() };
          renderTwoFactorSettings();
          showToast("Autenticação em duas etapas ativada.");
          return;
        }
        if (form.id === "twoFactorRecoveryForm") {
          const result = await api("/api/admin/2fa/recovery-codes", { method: "POST", body: JSON.stringify(values) });
          state.twoFactorRecoveryCodes = result.recoveryCodes || [];
          renderTwoFactorSettings();
          showToast("Novos códigos gerados.");
          return;
        }
        if (form.id === "twoFactorDisableForm") {
          await api("/api/admin/2fa/disable", { method: "POST", body: JSON.stringify(values) });
          await loadTwoFactorStatus();
          closeTwoFactorSettings();
          showSuccess("2FA desativado", "Esta conta voltará a entrar somente com e-mail e senha.");
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        if (submitButton && submitButton.isConnected) submitButton.disabled = false;
      }
    });
    $("twoFactorBody")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-two-factor-action]");
      if (!button) return;
      const action = button.dataset.twoFactorAction;
      if (action === "download-recovery") downloadRecoveryCodes();
      if (action === "copy-recovery") {
        const text = state.twoFactorRecoveryCodes.join("\n");
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const field = document.createElement("textarea");
          field.value = text;
          document.body.appendChild(field);
          field.select();
          document.execCommand("copy");
          field.remove();
        }
        showToast("Códigos copiados.");
      }
      if (action === "finish") {
        state.twoFactorRecoveryCodes = [];
        await loadTwoFactorStatus();
        if (state.adminUser?.twoFactorSetupRequired && state.twoFactorStatus?.enabled) {
          state.adminUser.twoFactorSetupRequired = false;
          state.adminUser.twoFactorEnabled = true;
          closeTwoFactorSettings();
          await loadContent();
        }
        closeTwoFactorSettings();
        await loadAdminUser();
      }
    });
  }
  const api = Object.freeze({ bindAccountEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindAccountEvents = api; }
})(globalThis);
