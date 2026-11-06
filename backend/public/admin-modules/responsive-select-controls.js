((root) => {
  function createResponsiveSelectControls({ $, escapeHtml }) {
    function setupResponsiveSelects() {
      ["paymentFilterStatus", "paymentFilterMethod", "paymentFilterOrigin", "paymentFilterProvider"].forEach((id) => {
        const select = $(id);
        if (!select || select.dataset.responsiveSelectReady) return;
        select.dataset.responsiveSelectReady = "true";
        const wrapper = document.createElement("div");
        wrapper.className = "responsive-select";
        wrapper.dataset.selectId = id;
        wrapper.innerHTML = `
          <button class="responsive-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span></span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="responsive-select-menu" role="listbox" hidden></div>
        `;
        select.insertAdjacentElement("afterend", wrapper);

        const sync = () => syncResponsiveSelect(select, wrapper);
        sync();
        select.addEventListener("change", sync);
        wrapper.querySelector(".responsive-select-button").addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const menu = wrapper.querySelector(".responsive-select-menu");
          const willOpen = menu.hidden;
          closeResponsiveSelects();
          if (willOpen) {
            syncResponsiveSelect(select, wrapper);
            menu.hidden = false;
            wrapper.querySelector(".responsive-select-button").setAttribute("aria-expanded", "true");
            positionResponsiveSelectMenu(wrapper);
          }
        });
      });

      window.addEventListener("resize", positionOpenResponsiveSelect);
      window.addEventListener("scroll", positionOpenResponsiveSelect, true);
    }

    function syncResponsiveSelect(select, wrapper) {
      const selectedOption = select.options[select.selectedIndex] || select.options[0];
      const label = selectedOption?.textContent || "Selecionar";
      wrapper.querySelector(".responsive-select-button span").textContent = label;
      wrapper.querySelector(".responsive-select-menu").innerHTML = Array.from(select.options).map((option) => `
        <button type="button" role="option" aria-selected="${option.value === select.value}" data-value="${escapeHtml(option.value)}">
          ${escapeHtml(option.textContent || option.value || "Selecionar")}
        </button>
      `).join("");
      wrapper.querySelectorAll(".responsive-select-menu button").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          select.value = button.dataset.value || "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          closeResponsiveSelects();
        });
      });
    }

    function positionResponsiveSelectMenu(wrapper) {
      const button = wrapper.querySelector(".responsive-select-button");
      const menu = wrapper.querySelector(".responsive-select-menu");
      if (!button || !menu || menu.hidden) return;
      const rect = button.getBoundingClientRect();
      const margin = 10;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const width = Math.min(Math.max(rect.width, 180), viewportWidth - margin * 2);
      const maxHeight = Math.min(300, viewportHeight - margin * 2);
      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${maxHeight}px`;
      const height = Math.min(menu.scrollHeight || maxHeight, maxHeight);
      const below = rect.bottom + 6;
      const openAbove = below + height > viewportHeight - margin && rect.top > height + margin;
      const top = openAbove ? Math.max(margin, rect.top - height - 6) : Math.min(below, viewportHeight - height - margin);
      const left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function positionOpenResponsiveSelect() {
      document.querySelectorAll(".responsive-select-menu:not([hidden])").forEach((menu) => {
        const wrapper = menu.closest(".responsive-select");
        if (wrapper) positionResponsiveSelectMenu(wrapper);
      });
    }

    function closeResponsiveSelects() {
      document.querySelectorAll(".responsive-select-menu").forEach((menu) => {
        menu.hidden = true;
        menu.closest(".responsive-select")?.querySelector(".responsive-select-button")?.setAttribute("aria-expanded", "false");
      });
    }
    return { setupResponsiveSelects, syncResponsiveSelect, positionResponsiveSelectMenu, positionOpenResponsiveSelect, closeResponsiveSelects };
  }
  const api = Object.freeze({ createResponsiveSelectControls });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.responsiveSelectControls = api; }
})(globalThis);
