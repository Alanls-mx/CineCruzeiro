function createSessionTicketManifestPdf({ pdfRect, pdfLine, pdfWriteText, buildPdf }) {
  return function sessionTicketManifestPdf({ cinemaName, movie, session, tickets, generatedAt = new Date() }) {
    const valid = (tickets || []).filter((ticket) => ticket.sessionId === session.id && ["active", "used"].includes(ticket.status));
    valid.sort((a, b) => String(a.seatLabel || a.seat || "").localeCompare(String(b.seatLabel || b.seat || ""), "pt-BR", { numeric: true }));
    const totalPages = Math.max(1, Math.ceil(valid.length / 24));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(session.date || "") ? `${session.date.slice(8, 10)}/${session.date.slice(5, 7)}/${session.date.slice(0, 4)}` : session.date || "-";
    const generated = generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const short = (value, size) => {
      const text = String(value || "-").replace(/[\r\n\t]+/g, " ").trim();
      return text.length > size ? `${text.slice(0, size - 1)}…` : text;
    };
    const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
      let page = pdfRect(0, 0, 595, 842, "#ffffff");
      page += pdfRect(0, 694, 595, 148, "#101827");
      page += pdfRect(0, 690, 595, 4, "#eab308");
      page += pdfWriteText(short(cinemaName || "Cinema", 40).toUpperCase(), 36, 799, 11, { bold: true, color: "#facc15" });
      page += pdfWriteText("LISTA DA SESSÃO", 36, 764, 23, { bold: true, color: "#ffffff" });
      page += pdfWriteText(short(movie?.title, 68), 36, 732, 12, { bold: true, color: "#e2e8f0" });
      page += pdfWriteText(`${date}  |  ${session.time || "--:--"}  |  ${short(session.room || "Sala", 34)}`, 36, 709, 10, { color: "#cbd5e1" });
      page += pdfWriteText(`${valid.length} ingresso(s) válido(s)  |  ${valid.filter((ticket) => ticket.status === "used").length} validado(s)`, 36, 665, 10, { bold: true, color: "#0f172a" });
      page += pdfWriteText(`Gerado em ${generated}`, 365, 665, 9, { color: "#475569" });
      page += pdfRect(32, 612, 531, 31, "#e8eef5");
      for (const [label, x] of [["POLTRONA", 42], ["NOME", 105], ["TIPO", 271], ["CÓDIGO", 361], ["STATUS", 466], ["ORIGEM", 526]]) {
        page += pdfWriteText(label, x, 624, 8, { bold: true, color: "#334155" });
      }
      valid.slice(pageIndex * 24, (pageIndex + 1) * 24).forEach((ticket, index) => {
        const top = 610 - index * 22;
        if (index % 2 === 0) page += pdfRect(32, top - 22, 531, 22, "#f8fafc");
        page += pdfLine(32, top - 22, 563, top - 22, "#e2e8f0", 0.5);
        const y = top - 15;
        page += pdfWriteText(short(ticket.seatLabel || ticket.seat || "Livre", 7), 42, y, 8, { bold: true, color: "#0f172a" });
        page += pdfWriteText(short(ticket.customerName || "Nome não informado", 28), 105, y, 9, { bold: true, color: "#0f172a" });
        page += pdfWriteText(short(ticket.ticketType || "Ingresso", 15), 271, y, 8, { color: "#334155" });
        page += pdfWriteText(short(ticket.displayCode || ticket.code || ticket.id, 18), 361, y, 8, { color: "#334155" });
        page += pdfWriteText(ticket.status === "used" ? "Validado" : "Válido", 466, y, 8, { color: "#334155" });
        page += pdfWriteText(ticket.source === "online" ? "Online" : "Presencial", 526, y, 7, { color: "#334155" });
      });
      if (!valid.length) page += pdfWriteText("Nenhum ingresso válido registrado nesta sessão.", 42, 580, 11, { color: "#475569" });
      page += pdfLine(32, 65, 563, 65, "#cbd5e1", 0.8);
      page += pdfWriteText("Cópia para conferência offline. Consulte a situação atual quando o sistema voltar.", 32, 45, 8, { color: "#64748b" });
      page += pdfWriteText(`Página ${pageIndex + 1} de ${totalPages}`, 495, 45, 8, { color: "#64748b" });
      return page;
    });
    return buildPdf(pages);
  };
}

module.exports = { createSessionTicketManifestPdf };
