function googleWalletLocalized(value) {
  return { defaultValue: { language: "pt-BR", value: String(value || "") } };
}

function createWalletTicketObjectPresenter({ buildGoogleWalletTextModules }) {
  function buildWalletTicketObject({ config, enriched, walletPosterUrl, objectId, frontendUrl, user, ticket }) {
    const sessionStart = new Date(`${enriched.sessionDate || ""}T${enriched.sessionTime || "00:00"}:00-03:00`);
    const archiveAt = new Date(enriched.archiveAt || "");
    const validTimeInterval = Number.isFinite(sessionStart.getTime())
      ? {
          start: { date: sessionStart.toISOString() },
          end: {
            date: (Number.isFinite(archiveAt.getTime()) && archiveAt > sessionStart
              ? archiveAt
              : new Date(sessionStart.getTime() + 24 * 60 * 60 * 1000)).toISOString()
          }
        }
      : undefined;
    const seatLabel = String(enriched.seat || "").trim();
    const seatRow = seatLabel.match(/^[A-Za-z]+/)?.[0] || "";

    return {
      id: objectId,
      classId: config.classId,
      state: enriched.status === "active" ? "ACTIVE" : "INACTIVE",
      heroImage: walletPosterUrl ? {
        sourceUri: { uri: walletPosterUrl },
        contentDescription: googleWalletLocalized(`Poster de ${enriched.movieTitle || "filme"}`)
      } : undefined,
      imageModulesData: [],
      hexBackgroundColor: "#0b1424",
      ticketHolderName: user.name || enriched.customerName || "Cliente",
      ticketNumber: enriched.displayCode,
      ticketType: googleWalletLocalized(enriched.ticketType || "Ingresso"),
      seatInfo: seatLabel ? {
        seat: googleWalletLocalized(seatLabel),
        ...(seatRow ? { row: googleWalletLocalized(seatRow) } : {})
      } : undefined,
      reservationInfo: {
        confirmationCode: String(enriched.orderId || ticket.orderId || enriched.displayCode || ticket.id)
      },
      barcode: {
        type: "QR_CODE",
        value: enriched.displayQrPayload,
        alternateText: enriched.displayCode
      },
      validTimeInterval,
      textModulesData: buildGoogleWalletTextModules(enriched),
      linksModuleData: {
        uris: [{ id: "conta", uri: `${frontendUrl}/conta/ingressos`, description: "Meus ingressos" }]
      }
    };
  }
  return { buildWalletTicketObject };
}

module.exports = { createWalletTicketObjectPresenter };
