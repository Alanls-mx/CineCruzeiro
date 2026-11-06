((root) => {
  function bindAdministrativeRecordEvents({
    $, assignClubSubscription, cancelCreation, clearImageField, deleteAd, deleteClubPlan,
    deleteCustomerUser, deletePromotion, deleteUser, newAd, newClubPlan, newCustomerUser,
    newPromotion, newUser, renderAdminImagePreview, renderCustomerUsers, saveAd, saveClubPlan,
    saveCustomerUser, savePromotion, saveUser, selectedUserPermissions, setPromotionView, state,
    syncUserPermissionEditor, toggleAdsStatus, uploadAdminImage
  }) {
    $("newPromotionButton").addEventListener("click", newPromotion);
    $("activePromotionsTab").addEventListener("click", () => setPromotionView("active"));
    $("archivedPromotionsTab").addEventListener("click", () => setPromotionView("archived"));
    $("cancelPromotionCreateButton").addEventListener("click", () => cancelCreation("promotion"));
    $("promotionForm").addEventListener("submit", savePromotion);
    $("promotionCouponCode").addEventListener("input", (event) => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    });
    $("deletePromotionButton").addEventListener("click", deletePromotion);
    $("newAdButton").addEventListener("click", newAd);
    $("adsMasterToggle")?.addEventListener("click", toggleAdsStatus);
    $("cancelAdCreateButton").addEventListener("click", () => cancelCreation("ad"));
    $("adForm").addEventListener("submit", saveAd);
    $("deleteAdButton").addEventListener("click", deleteAd);
    $("adImageUpload").addEventListener("change", () => uploadAdminImage("adImageUpload", "adImageUrl", "adImagePreview", "ads"));
    $("adImageUrl").addEventListener("input", () => renderAdminImagePreview("adImageUrl", "adImagePreview", "Prévia do anúncio"));
    $("adImageClear").addEventListener("click", () => clearImageField("adImageUrl", "adImagePreview", "Prévia do anúncio"));

    $("newUserButton").addEventListener("click", newUser);
    $("cancelUserCreateButton").addEventListener("click", () => cancelCreation("user"));
    $("userForm").addEventListener("submit", saveUser);
    $("deleteUserButton").addEventListener("click", deleteUser);
    $("userRole")?.addEventListener("change", () => syncUserPermissionEditor());
    $("userUseCustomPermissions")?.addEventListener("change", () => syncUserPermissionEditor(selectedUserPermissions()));
    $("newCustomerUserButton")?.addEventListener("click", newCustomerUser);
    $("cancelCustomerUserCreateButton")?.addEventListener("click", () => cancelCreation("customerUser"));
    $("customerUserForm")?.addEventListener("submit", saveCustomerUser);
    $("deleteCustomerUserButton")?.addEventListener("click", deleteCustomerUser);
    $("customerAccountsSearch")?.addEventListener("input", (event) => {
      state.customerAccountsSearch = event.target.value;
      state.customerAccountsPage = 1;
      renderCustomerUsers();
    });

    $("newClubPlanButton").addEventListener("click", newClubPlan);
    $("clubPlanActive")?.addEventListener("change", (event) => {
      const active = Boolean(event.target.checked);
      $("clubPlanForm")?.classList.toggle("is-inactive", !active);
      if ($("clubPlanEditorStatusText")) $("clubPlanEditorStatusText").textContent = active ? "Ativo" : "Inativo";
    });
    $("cancelClubPlanCreateButton").addEventListener("click", () => cancelCreation("clubPlan"));
    $("clubPlanForm").addEventListener("submit", saveClubPlan);
    $("deleteClubPlanButton")?.addEventListener("click", deleteClubPlan);
    $("clubAssignForm").addEventListener("submit", assignClubSubscription);
  }
  const api = Object.freeze({ bindAdministrativeRecordEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindAdministrativeRecordEvents = api; }
})(globalThis);
