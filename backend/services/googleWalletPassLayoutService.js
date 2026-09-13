function fieldSelector(fieldPath) {
  return { fields: [{ fieldPath }] };
}

function normalizeGoogleWalletResourceId(issuerId, resourceId) {
  const safeIssuer = String(issuerId || "").trim();
  const safeResource = String(resourceId || "").trim();
  if (!safeIssuer || !safeResource) return safeResource;

  const issuerPrefix = `${safeIssuer}.`;
  if (!safeResource.startsWith(issuerPrefix)) {
    return safeResource.includes(".") ? safeResource : `${issuerPrefix}${safeResource}`;
  }

  let suffix = safeResource;
  while (suffix.startsWith(issuerPrefix)) suffix = suffix.slice(issuerPrefix.length);
  return suffix ? `${issuerPrefix}${suffix}` : safeResource;
}

function templateItem(firstFieldPath, secondFieldPath = "") {
  return {
    firstValue: fieldSelector(firstFieldPath),
    ...(secondFieldPath ? { secondValue: fieldSelector(secondFieldPath) } : {})
  };
}

function buildGoogleWalletClassTemplateInfo() {
  return {
    cardTemplateOverride: {
      cardRowTemplateInfos: [
        {
          threeItems: {
            startItem: templateItem("object.textModulesData['filme']", "object.textModulesData['sessao']"),
            middleItem: templateItem("object.textModulesData['sala']", "object.textModulesData['tipo']"),
            endItem: templateItem("object.textModulesData['assento']")
          }
        }
      ]
    },
    detailsTemplateOverride: {
      detailsItemInfos: [
        { item: templateItem("object.textModulesData['bomboniere']") },
        { item: templateItem("object.linksModuleData.uris['conta']") }
      ]
    }
  };
}

function formatConcessionItems(items = []) {
  return items
    .filter((item) => item && Number(item.quantity || 0) > 0
      && !["cancelled", "refunded"].includes(String(item.status || ""))
      && String(item.refundStatus || "") !== "completed")
    .map((item) => `${Number(item.quantity || 0)}x ${String(item.name || "Item da bomboniere").trim()}`)
    .join("\n");
}

function formatSessionDate(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (normalized || "Data a confirmar");
}

function buildGoogleWalletTextModules(enriched = {}) {
  const concessions = formatConcessionItems(enriched.extras);
  return [
    { id: "filme", header: "Filme", body: String(enriched.movieTitle || "Cine Cruzeiro") },
    {
      id: "sessao",
      header: "Data / horario",
      body: `${formatSessionDate(enriched.sessionDate)} as ${String(enriched.sessionTime || "Horario a confirmar")}`
    },
    { id: "sala", header: "Sala", body: String(enriched.sessionRoom || "Sala Cruzeiro") },
    { id: "assento", header: "Assento", body: String(enriched.seat || "Lugar livre") },
    { id: "tipo", header: "Tipo do ingresso", body: String(enriched.ticketType || "Ingresso normal") },
    ...(concessions ? [{ id: "bomboniere", header: "Itens da bomboniere", body: concessions }] : [])
  ].filter((module) => module.id && module.header && String(module.body || "").trim());
}

module.exports = {
  buildGoogleWalletClassTemplateInfo,
  buildGoogleWalletTextModules,
  formatConcessionItems,
  formatSessionDate,
  normalizeGoogleWalletResourceId
};
