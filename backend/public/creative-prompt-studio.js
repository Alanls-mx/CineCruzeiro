(() => {
  const endpoint = "/api/admin/creative-prompts";
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let catalog = {};
  let run = null;
  let artworkUrl = "";
  let referenceUrl = "";
  let busy = false;
  let loaded = false;

  function message(value, error = false) {
    $("creativePromptFormStatus").textContent = value;
    $("creativePromptFormStatus").dataset.state = error ? "error" : "";
  }
  function setBusy(next, value = "") {
    busy = next;
    $("creativePromptGenerate").disabled = next;
    $("creativePromptRegenerate").disabled = next;
    if (value) message(value);
  }
  function assetUrl(value) {
    const url = String(value || "").trim();
    if (/^https:\/\//i.test(url)) return url;
    if (!url.startsWith("/")) return "";
    const base = window.location.pathname.split("/admin")[0];
    return base && !url.startsWith(`${base}/`) ? `${base}${url}` : url;
  }
  function sourceItems() {
    const category = $("creativePromptCategory").value;
    if (["films", "programming"].includes(category)) return (state.content?.movies || [])
      .filter((item) => !item.metadata?.catalogDeletedAt).map((item) => ({ ...item, label: item.title }));
    if (category === "concessions") return (state.content?.concessions || []).map((item) => ({ ...item, label: item.name }));
    if (["promotions", "coupons"].includes(category)) return (state.content?.promotions || []).map((item) => ({ ...item, label: item.title }));
    return [];
  }
  function source() { return sourceItems().find((item) => item.id === $("creativePromptSource").value) || null; }
  function sourceFacts(item) {
    if (!item) return {};
    const category = $("creativePromptCategory").value;
    if (category === "films") return { title: item.title, release: item.releaseDate || "", rating: item.rating || "",
      synopsis: item.synopsis || "", sessions: (item.sessions || []).filter((s) => s.date && s.time).map((s) => `${s.date} ${s.time}`).join("\n") };
    if (category === "programming") return { movies: item.title, sessions: (item.sessions || [])
      .filter((s) => s.date && s.time).map((s) => `${s.date} ${s.time}`).join("\n") };
    if (category === "concessions") return { product: item.name, components: (item.comboItems || [])
      .map((part) => `${part.quantity}x ${part.name}`).join("\n"),
      price: Number(item.price) > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price) : "" };
    if (category === "coupons") return { code: item.couponCode || "", benefit: item.title,
      validity: item.endsAt || "", rules: item.description || "" };
    if (category === "promotions") return { benefit: item.title, period: [item.startsAt, item.endsAt].filter(Boolean).join(" a "),
      conditions: item.description || "" };
    return {};
  }
  function renderSourceOptions() {
    const select = $("creativePromptSource");
    const previous = select.value;
    const items = sourceItems();
    $("creativePromptSourceWrap").hidden = !["films", "programming", "concessions", "promotions", "coupons"].includes($("creativePromptCategory").value);
    select.innerHTML = `<option value="">Preencher manualmente</option>${items.map((item) =>
      `<option value="${escape(item.id)}">${escape(item.label)}</option>`).join("")}`;
    if (items.some((item) => item.id === previous)) select.value = previous;
    renderArtwork();
  }
  function renderFields(values = {}) {
    const profile = catalog[$("creativePromptCategory").value];
    if (!profile) return;
    $("creativePromptContextFields").innerHTML = profile.fields.map((item) => {
      const id = `creativeMarketingFact_${item.key}`;
      const control = item.multiline
        ? `<textarea id="${id}" rows="3" maxlength="1600" ${item.required ? "required" : ""}>${escape(values[item.key] || "")}</textarea>`
        : `<input id="${id}" type="text" maxlength="1600" value="${escape(values[item.key] || "")}" ${item.required ? "required" : ""} />`;
      return `<label>${escape(item.label)}${item.required ? " *" : ""}${control}</label>`;
    }).join("");
    $("creativePromptCampaignWrap").hidden = $("creativePromptCategory").value !== "films";
    const role = $("creativePromptCategory").value === "films" ? "official" : "product";
    $("creativePromptArtworkRole").value = role;
    const film = ["films", "programming"].includes($("creativePromptCategory").value);
    $("creativePromptBackdropArt").hidden = !film;
    $("creativePromptCatalogArt").querySelector("input").checked = true;
    $("creativePromptCatalogArt").querySelector("input").parentElement.lastChild.textContent = film ? " Pôster" : " Cadastrada";
    renderSourceOptions();
  }
  function renderArtwork() {
    const choice = document.querySelector('input[name="creativePromptArtwork"]:checked')?.value || "none";
    const item = source();
    $("creativePromptArtworkUploadWrap").hidden = choice !== "upload";
    $("creativePromptRoleWrap").hidden = choice === "none";
    const url = choice === "upload" ? artworkUrl : choice === "backdrop" ? item?.backdropUrl
      : ["films", "programming"].includes($("creativePromptCategory").value) ? item?.posterUrl : item?.imageUrl;
    const preview = $("creativePromptArtworkPreview");
    preview.replaceChildren();
    if (choice === "none") { preview.textContent = "Sem imagem: descreva a intenção visual no briefing."; return; }
    if (!url) { preview.textContent = choice === "upload" ? "Envie JPG, PNG ou WebP." : "Escolha um item com imagem ou faça upload."; return; }
    const image = document.createElement("img");
    image.src = assetUrl(url);
    image.alt = "Imagem principal selecionada";
    preview.append(image);
  }
  function renderReference() {
    const preview = $("creativePromptReferencePreview");
    preview.replaceChildren();
    preview.hidden = !referenceUrl;
    $("creativePromptReferenceClear").hidden = !referenceUrl;
    if (!referenceUrl) return;
    const image = document.createElement("img");
    image.src = assetUrl(referenceUrl);
    image.alt = "Referência visual";
    preview.append(image);
  }
  async function upload(file, kind) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)
      throw new Error("Envie JPG, PNG ou WebP de até 5 MB.");
    setBusy(true, "Enviando imagem...");
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const result = await api(`${endpoint}/images`, { method: "POST", body: JSON.stringify({
        data, filename: file.name, contentType: file.type
      }) });
      if (kind === "artwork") { artworkUrl = result.url; renderArtwork(); }
      else { referenceUrl = result.url; renderReference(); }
      message("Imagem enviada. A análise visual é opcional.");
    } finally { setBusy(false); }
  }
  function payload(bias = "") {
    const category = $("creativePromptCategory").value;
    const facts = Object.fromEntries((catalog[category]?.fields || []).map((item) =>
      [item.key, $(`creativeMarketingFact_${item.key}`)?.value.trim() || ""]));
    const choice = document.querySelector('input[name="creativePromptArtwork"]:checked')?.value || "none";
    const item = source();
    return {
      studioVersion: 2, category, format: $("creativePromptFormat").value,
      density: $("creativePromptDensity").value, facts,
      ...(item && ["films", "programming"].includes(category) ? { movieId: item.id, movieArtwork: choice } : {}),
      ...(item && category === "concessions" ? { concessionId: item.id } : {}),
      ...(item && ["promotions", "coupons"].includes(category) ? { promotionId: item.id } : {}),
      artworkRole: choice === "none" ? "none" : $("creativePromptArtworkRole").value,
      imageChoice: choice,
      artworkUrl: choice === "upload" ? artworkUrl : "",
      referenceUrl, visualDescription: $("creativePromptVisualDescription").value.trim(),
      referenceDescription: $("creativePromptReferenceDescription").value.trim(),
      requiredText: $("creativePromptMessage").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      cta: $("creativePromptCta").value.trim(), audience: $("creativePromptTagline").value.trim(),
      directionNote: $("creativePromptVisualNote").value.trim(),
      objective: $("creativePromptObjective").value.trim() || (category === "films" ? $("creativePromptCampaign").selectedOptions[0]?.textContent || "" : ""),
      bias
    };
  }
  function renderRun() {
    $("creativePromptEmpty").hidden = Boolean(run);
    $("creativePromptVariants").hidden = !run;
    $("creativePromptOutput").hidden = !run?.promptText;
    if (!run) return;
    $("creativePromptVariantList").innerHTML = (run.variants || []).map((item) => `
      <button class="creative-prompt-variant" type="button" data-creative-variant="${escape(item.id)}" aria-pressed="${item.id === run.selectedVariant}">
        <strong>${escape(item.label || item.id)}</strong><span>${escape(item.summary)}</span>
        <small>${escape(item.artDirection)}</small></button>`).join("");
    document.querySelectorAll("[data-creative-refine]").forEach((button) => {
      button.hidden = button.dataset.creativeRefine !== "minimal" &&
        !(run.variants || []).some((item) => item.id === button.dataset.creativeRefine);
    });
    if (!run.promptText) return;
    const brief = run.brief || {};
    $("creativePromptDirectionSummary").textContent = brief.artDirection || brief.summary || "";
    $("creativePromptDecisions").innerHTML = [
      ["Paleta", brief.palette || brief.paletteDirection], ["Densidade", brief.density],
      ["Composição", brief.composition], ["Acabamento", brief.finish || brief.premiumFinish]
    ].filter(([, value]) => value).map(([label, value]) => `<span><strong>${escape(label)}:</strong> ${escape(value)}</span>`).join("");
    $("creativePromptText").value = run.promptText;
    $("creativePromptAssets").innerHTML = [["Abrir imagem", run.artworkUrl],
      ["Abrir referência", run.referenceUrl], ["Assinatura do cinema", "/images/logo-display.webp"]]
      .filter(([, value]) => value).map(([label, value]) => `<a href="${escape(assetUrl(value))}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`).join("");
    $("creativePromptSaveStatus").textContent = run.status === "saved" ? "Salvo" : "Pronto";
    const warning = (run.input?.warnings || []).join(" ");
    if (warning) message(warning);
    else if (run.briefVersion === 2 && brief.visualAnalysisStatus !== "analyzed") message("Prompt criado sem análise visual. Revise a imagem e os textos no Canva.");
  }
  async function generate(bias = "") {
    if (busy) return;
    setBusy(true, "Preparando direções criativas...");
    try {
      const response = await api(`${endpoint}/directions`, { method: "POST", body: JSON.stringify(payload(bias)) });
      run = response.run;
      renderRun();
      if (!run.input?.warnings?.length) message("Direções prontas. Escolha uma abordagem para gerar o prompt.");
    } catch (error) { message(error.message || "Não foi possível gerar a direção.", true); }
    finally { setBusy(false); }
  }
  async function compile(variantId) {
    if (!run || busy) return;
    setBusy(true, "Compilando e verificando dados...");
    try {
      const current = payload();
      const response = await api(`${endpoint}/${run.id}/compile`, { method: "POST", body: JSON.stringify({
        variantId, edits: { facts: current.facts, requiredText: current.requiredText, cta: current.cta,
          audience: current.audience, directionNote: current.directionNote,
          visualDescription: current.visualDescription, referenceDescription: current.referenceDescription,
          objective: current.objective, density: current.density, format: current.format }
      }) });
      run = response.run;
      renderRun();
      message("Prompt revisado e pronto para copiar. Confira os textos no Canva.");
      void loadHistory();
    } catch (error) { message(error.message || "O prompt não passou pela revisão.", true); }
    finally { setBusy(false); }
  }
  async function loadHistory() {
    try {
      const result = await api(`${endpoint}/history`);
      $("creativePromptHistoryList").innerHTML = result.runs?.length ? result.runs.map((item) => `
        <div class="creative-prompt-history-item"><div><strong>${escape(item.movieTitle || catalog[item.category]?.name || "Campanha")}</strong>
        <span>${escape(catalog[item.category]?.name || item.campaignType)} · ${escape(item.format)} · ${escape(new Date(item.createdAt).toLocaleString("pt-BR"))}</span></div>
        <div class="creative-prompt-history-actions"><button class="ghost-button" type="button" data-creative-history="${escape(item.id)}">Visualizar</button>
        <button class="ghost-button" type="button" data-creative-redo="${escape(item.id)}">Refazer</button></div></div>`).join("")
        : '<div class="creative-prompt-empty"><strong>Nenhuma direção salva</strong><span>As campanhas geradas aparecerão aqui.</span></div>';
    } catch (error) { $("creativePromptHistoryList").textContent = error.message || "Não foi possível carregar o histórico."; }
  }
  async function loadStatus() {
    try {
      const result = await api(`${endpoint}/status`);
      const badge = $("creativePromptProviderStatus");
      badge.textContent = !result.databaseReady ? "PostgreSQL indisponível"
        : result.localVisionAvailable ? "Visão local configurada"
          : result.enabled && result.configured ? `Visão IA configurada · ${result.model}` : "Modo manual disponível";
      badge.classList.toggle("muted", !result.databaseReady || !(result.localVisionAvailable || (result.enabled && result.configured)));
    } catch { $("creativePromptProviderStatus").textContent = "Verificação indisponível"; }
  }
  function restore(current) {
    const input = current.input?.request;
    if (!input || current.briefVersion !== 2) return;
    $("creativePromptCategory").value = input.category;
    renderFields(input.facts);
    $("creativePromptFormat").value = input.format;
    $("creativePromptDensity").value = input.density;
    $("creativePromptSource").value = input.sourceId || input.movieId || "";
    $("creativePromptCta").value = input.cta || "";
    $("creativePromptObjective").value = input.objective || "";
    $("creativePromptTagline").value = input.audience || "";
    $("creativePromptMessage").value = (input.requiredText || []).join("\n");
    $("creativePromptVisualDescription").value = input.visualDescription || "";
    $("creativePromptReferenceDescription").value = input.referenceDescription || "";
    $("creativePromptVisualNote").value = input.directionNote || "";
    $("creativePromptArtworkRole").value = input.artworkRole === "none" ? "official" : input.artworkRole;
    artworkUrl = input.imageChoice === "upload" ? input.artworkUrl || "" : "";
    referenceUrl = input.referenceUrl || "";
    const choice = input.imageChoice || (input.artworkRole === "none" ? "none" : artworkUrl ? "upload" : "poster");
    document.querySelector(`input[name="creativePromptArtwork"][value="${choice}"]`).checked = true;
    renderArtwork(); renderReference();
  }
  async function openRun(id, redo) {
    try {
      const response = await api(`${endpoint}/${id}`);
      run = response.run;
      restore(run);
      renderRun();
      if (redo && run.briefVersion !== 2) message("Este registro usa o formato antigo. Visualize ou copie o prompt; crie uma campanha nova para refazer.");
      else if (redo) await generate("alternate");
      else $("creativePromptVariants").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { message(error.message || "Não foi possível abrir a campanha.", true); }
  }
  async function save() {
    if (!run?.promptText) return;
    try {
      const response = await api(`${endpoint}/${run.id}/save`, { method: "POST", body: JSON.stringify({
        promptText: $("creativePromptText").value
      }) });
      run = response.run; renderRun(); message("Prompt salvo no histórico."); void loadHistory();
    } catch (error) { message(error.message, true); }
  }
  async function init() {
    if (loaded) return;
    loaded = true;
    try {
      const result = await api(`${endpoint}/categories`);
      catalog = result.categories || {};
      $("creativePromptCategory").innerHTML = Object.entries(catalog).map(([id, item]) =>
        `<option value="${escape(id)}">${escape(item.name)}</option>`).join("");
      renderFields();
      await Promise.all([loadStatus(), loadHistory()]);
    } catch (error) { message(error.message || "Não foi possível abrir o Studio.", true); }
  }
  function bind() {
    $("creativePromptCategory").addEventListener("change", () => {
      run = null; artworkUrl = ""; referenceUrl = "";
      for (const id of ["creativePromptObjective", "creativePromptCta", "creativePromptTagline",
        "creativePromptMessage", "creativePromptVisualDescription", "creativePromptVisualNote",
        "creativePromptReferenceDescription"]) $(id).value = "";
      renderFields(); renderReference(); renderRun();
    });
    $("creativePromptSource").addEventListener("change", () => {
      const facts = sourceFacts(source());
      for (const item of catalog[$("creativePromptCategory").value]?.fields || []) {
        const control = $(`creativeMarketingFact_${item.key}`);
        if (control) control.value = facts[item.key] || "";
      }
      renderArtwork();
    });
    document.querySelectorAll('input[name="creativePromptArtwork"]').forEach((radio) => radio.addEventListener("change", renderArtwork));
    $("creativePromptArtworkUpload").addEventListener("change", (event) => void upload(event.target.files?.[0], "artwork")
      .catch((error) => message(error.message, true)));
    $("creativePromptReferenceUpload").addEventListener("change", (event) => void upload(event.target.files?.[0], "reference")
      .catch((error) => message(error.message, true)));
    $("creativePromptReferenceClear").addEventListener("click", () => { referenceUrl = ""; renderReference(); });
    $("creativePromptForm").addEventListener("submit", (event) => { event.preventDefault(); void generate(); });
    $("creativePromptVariantList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-creative-variant]");
      if (button) void compile(button.dataset.creativeVariant);
    });
    $("creativePromptRegenerate").addEventListener("click", () => void generate("alternate"));
    $("creativePromptCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("creativePromptText").value); message("Prompt copiado."); }
      catch { message("O navegador não permitiu copiar. Selecione o texto do prompt.", true); }
    });
    $("creativePromptSave").addEventListener("click", () => void save());
    $("creativePromptDuplicate").addEventListener("click", async () => {
      if (!run) return;
      try { run = (await api(`${endpoint}/${run.id}/duplicate`, { method: "POST", body: "{}" })).run;
        renderRun(); message("Direção duplicada. Escolha uma variante."); }
      catch (error) { message(error.message, true); }
    });
    $("creativePromptEdit").addEventListener("click", () => {
      document.querySelector(".creative-prompt-more").open = true;
      $("creativePromptMessage").focus(); $("creativePromptUpdate").hidden = false;
    });
    $("creativePromptUpdate").addEventListener("click", () => void compile(run?.selectedVariant || "recommended"));
    document.querySelectorAll("[data-creative-refine]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.creativeRefine === "minimal") { $("creativePromptDensity").value = "minimal"; void generate("minimal"); }
      else { const id = run?.variants?.some((item) => item.id === button.dataset.creativeRefine)
        ? button.dataset.creativeRefine : run?.variants?.[1]?.id;
      if (id) void compile(id); }
    }));
    $("creativePromptRefreshHistory").addEventListener("click", () => void loadHistory());
    $("creativePromptHistoryList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-creative-history], [data-creative-redo]");
      if (button) void openRun(button.dataset.creativeHistory || button.dataset.creativeRedo, Boolean(button.dataset.creativeRedo));
    });
    document.addEventListener("admin:content", () => { if (loaded) renderSourceOptions(); });
    document.addEventListener("admin:panel", (event) => {
      if (event.detail?.panel === "marketingPanel" && state.adminSubtabs.marketing === "creative") void init();
    });
    document.addEventListener("admin:subtab", (event) => {
      if (event.detail?.group === "marketing" && event.detail?.tab === "creative") void init();
    });
    if (window.location.hash === "#marketingPanel" && state.adminSubtabs.marketing === "creative") void init();
  }
  bind();
})();
