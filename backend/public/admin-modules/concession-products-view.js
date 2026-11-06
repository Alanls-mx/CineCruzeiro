((root) => {
  function createConcessionProductsView({ state, $, adminAssetUrl, api, cleanAdminAssetUrl, creationPlaceholder, currentConcession, escapeHtml, formatConcessionStock, money, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, renderConcessionInsights, setDisabled, showSuccess, showToast, syncConcessionStockFields, syncCreationControl, upsertAdminCollection, confirm }) {
    function renderConcessions() {
      const allItems = state.content?.concessions || [];
      renderConcessionInsights();
      if (state.creating.concession) {
        $("concessionsList").innerHTML = creationPlaceholder("Novo produto", "Preencha nome, preço, estoque e imagem por upload no quadro à direita.");
        fillConcessionForm(null);
        return;
      }
      const categoryFilter = state.concessionCategoryFilter || "all";
      const items = categoryFilter === "all"
        ? allItems
        : allItems.filter((item) => (item.category || "combo").toLowerCase() === categoryFilter.toLowerCase());

      if (!items.length) {
        const filterLabel = categoryFilter !== "all" ? ` na categoria "${categoryFilter}"` : "";
        $("concessionsList").innerHTML = `<div class="empty-state"><strong>Nenhum produto cadastrado${escapeHtml(filterLabel)}</strong><span>Crie produtos para aparecerem no checkout ou selecione outra categoria.</span></div>`;
        fillConcessionForm(null);
        return;
      }

      const pagination = paginateAdminItems(items, "concessions", "selectedConcessionId");
      $("concessionsList").innerHTML = pagination.pageItems
        .map((item) => `
          <button class="list-item ${item.id === state.selectedConcessionId ? "active" : ""}" type="button" data-admin-select-kind="concession" data-admin-select-id="${escapeHtml(item.id)}">
            <span>
              <span class="list-title">${escapeHtml(item.name)}</span>
              <span class="list-meta">${escapeHtml(item.category || "combo")} • ${item.active ? "ativo" : "inativo"}${item.featured ? " • destaque" : ""}${item.stock !== "" && item.stock !== undefined ? ` • estoque ${escapeHtml(formatConcessionStock(item))}` : ""}</span>
            </span>
            <span class="badge">${money(item.price)}</span>
          </button>
        `)
        .join("") + renderAdminListPager("concessions", pagination, "produto(s)");
      fillConcessionForm(currentConcession());
    }

    function selectConcession(id) {
      delete state.pendingImages.concessionImageUrl;
      state.creating.concession = false;
      state.selectedConcessionId = id;
      renderConcessions();
    }

    function newConcession() {
      delete state.pendingImages.concessionImageUrl;
      state.creating.concession = true;
      state.selectedConcessionId = "";
      $("concessionsList").innerHTML = creationPlaceholder("Novo produto", "Preencha nome, preço, estoque e imagem por upload no quadro à direita.");
      fillConcessionForm(null);
      if (state.concessionCategoryFilter && state.concessionCategoryFilter !== "all") {
        if ($("concessionCategory")) $("concessionCategory").value = state.concessionCategoryFilter;
      }
    }

    function fillConcessionForm(item) {
      syncCreationControl("concession", "cancelConcessionCreateButton", "deleteConcessionButton", Boolean(item));
      setDisabled("deleteConcessionButton", !item);
      $("concessionId").value = item?.id || "";
      $("concessionSku").value = item?.sku || "";
      $("concessionName").value = item?.name || "";
      $("concessionBadge").value = item?.badge || "";
      $("concessionDescription").value = item?.description || "";
      $("concessionImageUrl").value = Object.prototype.hasOwnProperty.call(state.pendingImages, "concessionImageUrl")
        ? state.pendingImages.concessionImageUrl
        : item?.imageUrl || "";
      $("concessionPrice").value = item?.price ?? 0;
      $("concessionCompareAt").value = item?.compareAt || "";
      $("concessionStock").value = item?.stock ?? "";
      $("concessionStockUnit").value = item?.stockUnit || "unit";
      $("concessionUsagePerSale").value = item?.usagePerSale ?? 1;
      $("concessionMaxPerOrder").value = item?.maxPerOrder ?? 8;
      $("concessionSortOrder").value = item?.sortOrder ?? 100;
      $("concessionTags").value = (item?.tags || []).join(", ");
      $("concessionCategory").value = item?.category || "combo";
      $("concessionComboItems").value = (item?.comboItems || []).map((comboItem) => `${comboItem.name} | ${comboItem.quantity}`).join("\n");
      $("concessionFeatured").checked = Boolean(item?.featured);
      $("concessionActive").checked = item?.active !== false;
      syncConcessionStockFields();
      renderConcessionPreview();
    }

    function renderConcessionPreview() {
      const url = cleanAdminAssetUrl($("concessionImageUrl").value);
      $("concessionImagePreview").innerHTML = url
        ? `<img src="${escapeHtml(adminAssetUrl(url))}" alt="Prévia do produto" data-admin-image-fallback />`
        : "<span>Imagem do produto</span>";
    }

    async function saveConcession(event) {
      event.preventDefault();
      const requestedImageUrl = cleanAdminAssetUrl($("concessionImageUrl").value);
      try {
        const payload = {
          id: $("concessionId").value || undefined,
          sku: $("concessionSku").value,
          name: $("concessionName").value,
          badge: $("concessionBadge").value,
          description: $("concessionDescription").value,
          imageUrl: requestedImageUrl,
          price: Number($("concessionPrice").value || 0),
          compareAt: $("concessionCompareAt").value,
          stock: $("concessionStock").value,
          stockUnit: $("concessionStockUnit").value,
          usagePerSale: Number($("concessionUsagePerSale").value || 1),
          maxPerOrder: Number($("concessionMaxPerOrder").value || 8),
          sortOrder: Number($("concessionSortOrder").value || 100),
          tags: $("concessionTags").value,
          category: $("concessionCategory").value,
          comboItems: $("concessionComboItems").value,
          featured: $("concessionFeatured").checked,
          active: $("concessionActive").checked
        };
        const existingId = $("concessionId").value;
        const saved = existingId
          ? await api(`/api/concessions/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/concessions", { method: "POST", body: JSON.stringify(payload) });
        state.creating.concession = false;
        state.selectedConcessionId = saved.id;
        if (requestedImageUrl && cleanAdminAssetUrl(saved.imageUrl) !== requestedImageUrl) {
          throw new Error("O produto foi salvo, mas a imagem não foi persistida. Envie o arquivo novamente.");
        }
        delete state.pendingImages.concessionImageUrl;
        upsertAdminCollection("concessions", saved);
        state.content.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
        renderConcessions();
        showSuccess("Produto salvo", `${saved.name} ja pode aparecer na bomboniere do checkout.`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function deleteConcession() {
      const item = currentConcession();
      if (!item || !confirm(`Excluir ${item.name}?`)) return;
      try {
        await api(`/api/concessions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        state.selectedConcessionId = "";
        removeAdminCollectionItem("concessions", item.id);
        renderConcessions();
        showToast("Produto excluído.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { renderConcessions, selectConcession, newConcession, fillConcessionForm, renderConcessionPreview, saveConcession, deleteConcession };
  }

  const api = Object.freeze({ createConcessionProductsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.concessionProductsView = api; }
})(globalThis);
