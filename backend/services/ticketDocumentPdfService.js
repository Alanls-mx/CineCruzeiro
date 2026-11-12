function createTicketDocumentPdfService({
  backendDir, fs, path, crypto, QRCode, sharp, storageService,
  stripPublicAssetBase, pathIsInside, movieForTicket, slugify,
  downloadPublicBuffer, enrichTicket, brazilianDate, methodLabel
}) {
  const __dirname = backendDir;
function pdfText(value) {
  const safe = String(value ?? "").normalize("NFC").replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();
  const punctuation = { "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "..." };
  return `(${Array.from(safe, (character) => {
    const code = character.codePointAt(0);
    if (character === "\\" || character === "(" || character === ")") return `\\${character}`;
    if (code >= 32 && code <= 126) return character;
    if (code >= 160 && code <= 255) return `\\${code.toString(8).padStart(3, "0")}`;
    return punctuation[character] || "?";
  }).join("")})`;
}

function pdfColor(hex) {
  const value = String(hex || "#000000").replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

function pdfRect(x, y, width, height, color) {
  return `${pdfColor(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function pdfLine(x1, y1, x2, y2, color = "#334155", width = 1) {
  return `${pdfColor(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfWriteText(text, x, y, size, options = {}) {
  const font = options.bold ? "F2" : "F1";
  const color = pdfColor(options.color || "#ffffff");
  return `BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfText(text)} Tj ET\n`;
}

function pdfApproxTextWidth(text, size, options = {}) {
  const averageGlyphWidth = options.bold ? 0.58 : 0.52;
  return String(text || "").length * size * averageGlyphWidth;
}

function pdfWriteCenteredText(text, centerX, y, size, options = {}) {
  const width = pdfApproxTextWidth(text, size, options);
  return pdfWriteText(text, centerX - width / 2, y, size, options);
}

function wrapText(value, maxChars) {
  const words = String(value || "")
    .replace(/[-_/]/g, "$& ")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function pdfWriteMultiline(text, x, y, size, options = {}) {
  return wrapText(text, options.maxChars || 54)
    .slice(0, options.maxLines || 3)
    .map((line, index) => pdfWriteText(line, x, y - index * (options.lineHeight || size + 5), size, options))
    .join("");
}

function pdfWriteValueBlock(label, value, x, y, options = {}) {
  const labelSize = options.labelSize || 8;
  const valueSize = options.valueSize || 11;
  return [
    pdfWriteText(label, x, y, labelSize, { bold: true, color: options.labelColor || "#93c5fd" }),
    pdfWriteMultiline(value || "-", x, y - 18, valueSize, {
      bold: options.boldValue !== false,
      color: options.valueColor || "#ffffff",
      maxChars: options.maxChars || 28,
      maxLines: options.maxLines || 2,
      lineHeight: options.lineHeight || valueSize + 4
    })
  ].join("");
}

function brl(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function pdfDrawImage(name, x, y, width, height) {
  return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q\n`;
}

function jpegDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function readLocalPosterBuffer(posterUrl) {
  let pathname = "";
  try {
    pathname = new URL(posterUrl).pathname;
  } catch {
    pathname = String(posterUrl || "");
  }
  const uploadPath = stripPublicAssetBase(pathname);
  if (!uploadPath.startsWith("/uploads/")) return null;
  const filePath = path.normalize(path.join(storageService.rootDir, uploadPath.replace(/^\/uploads\//, "")));
  if (!pathIsInside(storageService.rootDir, filePath)) return null;
  const buffer = await fs.readFile(filePath).catch(() => null);
  if (!buffer) return null;
  if (jpegDimensions(buffer)) return buffer;
  return sharp(buffer).rotate().jpeg({ quality: 88, progressive: true }).toBuffer().catch(() => null);
}

async function cachedPosterBufferForTicket(db, enriched) {
  const movie = movieForTicket(db, enriched);
  const posterUrl = String(enriched.posterUrl || movie?.posterUrl || "");
  if (!posterUrl) return null;
  const local = await readLocalPosterBuffer(posterUrl);
  if (local) return local;
  if (!/^https?:\/\//i.test(posterUrl)) return null;

  const cacheKey = crypto
    .createHash("sha256")
    .update(`${movie?.id || enriched.movieId || enriched.movieTitle}:${posterUrl}`)
    .digest("hex")
    .slice(0, 24);
  const cacheDir = path.join(storageService.rootDir, "pdf-posters");
  const cachePath = path.join(cacheDir, `${slugify(movie?.id || enriched.movieId || enriched.movieTitle || "filme")}-${cacheKey}.jpg`);
  const cached = await fs.readFile(cachePath).catch(() => null);
  if (cached && jpegDimensions(cached)) return cached;

  try {
    const { buffer: sourceBuffer } = await downloadPublicBuffer(posterUrl, {
      httpsOnly: true,
      timeoutMs: 9000,
      maxBytes: 6 * 1024 * 1024,
      headers: { Accept: "image/jpeg,image/*;q=0.8" }
    });
    const buffer = jpegDimensions(sourceBuffer)
      ? sourceBuffer
      : await sharp(sourceBuffer).rotate().jpeg({ quality: 88, progressive: true }).toBuffer().catch(() => null);
    if (!buffer || !jpegDimensions(buffer)) return null;
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cachePath, buffer).catch(() => null);
    return buffer;
  } catch { return null; }
}

function ticketStatusLabel(status) {
  return {
    active: "Valido",
    used: "Usado",
    archived: "Arquivado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    pending_payment: "Aguardando pagamento"
  }[String(status || "")] || "Nao informado";
}

function pdfQr(payload, x, y, size, quietModules = 0) {
  const qr = QRCode.create(String(payload || ""), { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const cell = size / moduleCount;
  const quiet = Math.max(10, quietModules * cell);
  let output = pdfRect(x - quiet, y - quiet, size + 2 * quiet, size + 2 * quiet, "#ffffff");
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.modules.get(row, column)) {
        output += pdfRect(x + column * cell, y + (moduleCount - row - 1) * cell, cell + 0.05, cell + 0.05, "#020617");
      }
    }
  }
  return output;
}

function buildPdf(pages, options = {}) {
  const normalizedPages = Array.isArray(pages) ? pages : [pages];
  const pageCount = normalizedPages.length;
  const images = Array.isArray(options.images)
    ? options.images.filter((image) => image?.name && image?.buffer && image?.width && image?.height)
    : options.image
      ? [{ name: "Im1", ...options.image }]
      : [];
  const firstPageObject = 3;
  const contentStart = firstPageObject + pageCount;
  const fontRegularObject = contentStart + pageCount;
  const fontBoldObject = fontRegularObject + 1;
  const imageStartObject = fontBoldObject + 1;
  const resourceImage = images.length
    ? ` /XObject << ${images.map((image, index) => `/${image.name} ${imageStartObject + index} 0 R`).join(" ")} >>`
    : "";
  const pageKids = Array.from({ length: pageCount }, (_, index) => `${firstPageObject + index} 0 R`).join(" ");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "utf8"),
    Buffer.from(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>`, "utf8")
  ];

  normalizedPages.forEach((_, index) => {
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${options.width || 595} ${options.height || 842}] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >>${resourceImage} >> /Contents ${contentStart + index} 0 R >>`, "utf8"));
  });

  normalizedPages.forEach((content) => {
    const stream = Buffer.from(String(content || ""), "utf8");
    objects.push(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8"),
      stream,
      Buffer.from("\nendstream", "utf8")
    ]));
  });

  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "utf8"));
  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "utf8"));

  images.forEach((image) => {
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.buffer.length} >>\nstream\n`, "utf8"),
      image.buffer,
      Buffer.from("\nendstream", "utf8")
    ]));
  });

  const chunks = [Buffer.from("%PDF-1.4\n% Cine Cruzeiro\n", "utf8")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "utf8"), object, Buffer.from("\nendobj\n", "utf8"));
  });
  const body = Buffer.concat(chunks);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF`;
  return Buffer.concat([body, Buffer.from(xref, "utf8")]);
}

function ticketThermalPdf(db, tickets) {
  const pages = tickets.map((ticket) => {
    const item = enrichTicket(db, ticket);
    if (item.orderStatus === "paid_pending_print") item.status = "active";
    let y = 545;
    let content = "";
    const text = (value, size = 10, bold = false) => {
      const lines = wrapText(String(value || ""), size >= 14 ? 22 : 34).slice(0, 3);
      for (const line of lines) {
        content += pdfWriteText(line.replace(/([/_-]) /g, "$1"), 14, y, size, { bold, color: "#000000" });
        y -= size + 5;
      }
    };
    text("CINE CRUZEIRO", 14, true);
    text("INGRESSO - VIA PDV", 9);
    text(ticketStatusLabel(item.status).toUpperCase(), 10, true);
    text(item.movieTitle, 14, true);
    text(`${brazilianDate(item.sessionDate)} as ${item.sessionTime}`, 11, true);
    text(item.sessionRoom);
    text(item.sessionFormat);
    text(`POLTRONA: ${item.seat}`, 14, true);
    text(item.ticketType || "Ingresso");
    text(`CLIENTE: ${item.customerName || "Cliente"}`, 10, true);
    const qrSize = 120;
    content += pdfQr(item.displayQrPayload || item.qrPayload || item.code, 53, y - qrSize - 18, qrSize, 4);
    y -= qrSize + 45;
    text(item.displayCode || item.code, 8);
    text(`Pedido: ${item.orderReference || item.orderId}`, 8);
    text("Apresente este QR Code na entrada.", 8);
    text("Documento nao fiscal.", 8);
    const output = [content];
    if (item.extras?.length) {
      content = "";
      y = 545;
      text("CINE CRUZEIRO", 14, true);
      text("BOMBONIERE - VIA DO PEDIDO", 10, true);
      text(`Pedido: ${item.orderReference || item.orderId}`, 8);
      text(`${brazilianDate(item.sessionDate)} as ${item.sessionTime}`);
      for (const extra of item.extras) {
        const linesNeeded = Math.min(3, wrapText(`${extra.quantity} x ${extra.name}`, 34).length);
        if (y < 55 + linesNeeded * 15) { output.push(content); content = ""; y = 545; }
        text(`${extra.quantity} x ${extra.name}`, 10, true);
        text(`Entregue: ${Number(extra.fulfilledQuantity || 0)}`, 8);
      }
      text("Itens compartilhados pelo pedido.", 8);
      text("Documento nao fiscal.", 8);
      output.push(content);
    }
    return output;
  });
  return buildPdf(pages.flat(), { width: 226.77, height: 566.93 });
}

function concessionThermalPdf(order, payment) {
  const items = Array.isArray(order?.concessionItems) ? order.concessionItems.filter((item) => Number(item.quantity || 0) > 0) : [];
  const pages = [];
  let y = 545;
  let content = "";
  const text = (value, size = 9, bold = false, maxChars = 34) => {
    const lines = wrapText(String(value || ""), maxChars).slice(0, 4);
    for (const line of lines) {
      content += pdfWriteText(line, 14, y, size, { bold, color: "#000000" });
      y -= size + 5;
    }
  };
  const nextPage = () => {
    if (content) pages.push(content);
    content = "";
    y = 545;
    text("CINE CRUZEIRO", 14, true);
    text("BOMBONIERE - VIA PDV", 10, true);
  };
  nextPage();
  text("PAGAMENTO APROVADO", 9, true);
  text(`Pedido: ${order?.id || "-"}`, 8, false, 40);
  const purchasedAt = order?.paidAt || payment?.approvedAt || order?.createdAt || new Date().toISOString();
  text(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(purchasedAt)), 9);
  content += pdfLine(14, y, 212, y, "#000000", 0.8);
  y -= 18;
  items.forEach((item) => {
    if (y < 90) nextPage();
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.finalPrice ?? item.unitPrice ?? item.price ?? 0);
    text(`${quantity} x ${item.name || "Produto"}`, 10, true);
    text(`${brl(unitPrice)} cada - ${brl(quantity * unitPrice)}`, 8);
    y -= 4;
  });
  content += pdfLine(14, y, 212, y, "#000000", 0.8);
  y -= 20;
  text(`TOTAL: ${brl(order?.totalPrice || 0)}`, 13, true);
  text(`Pagamento: ${methodLabel(payment?.method || order?.paymentMethod)}`, 9);
  if (order?.createdByEmail) text(`Operador: ${order.createdByEmail}`, 8, false, 40);
  y -= 8;
  text("Venda presencial concluida.", 9, true);
  text("Documento nao fiscal.", 8);
  if (content) pages.push(content);
  return buildPdf(pages, { width: 226.77, height: 566.93 });
}

async function ticketDownloadPdf(db, ticket) {
  const enriched = enrichTicket(db, ticket);
  const showTicketAccess = enriched.status === "active";
  const sessionDate = brazilianDate(enriched.sessionDate);
  const seatLabel = enriched.seat || "Lugar livre";
  const extras = (enriched.extras || []).map((item) => `${item.name} x${Number(item.quantity || 0)}`).join(" - ");
  const formatLine = [enriched.sessionRoom || "Cine Cruzeiro", enriched.sessionFormat || "Sessao"].filter(Boolean).join(" - ");
  const posterBuffer = await cachedPosterBufferForTicket(db, enriched);
  const posterSize = posterBuffer ? jpegDimensions(posterBuffer) : null;
  const posterImage = posterBuffer && posterSize ? { name: "ImPoster", buffer: posterBuffer, ...posterSize } : null;
  const logoBuffer = await fs.readFile(path.join(__dirname, "..", "public", "images", "logo-pdf.jpg")).catch(() => null);
  const logoSize = logoBuffer ? jpegDimensions(logoBuffer) : null;
  const logoImage = logoBuffer && logoSize ? { name: "ImLogo", buffer: logoBuffer, ...logoSize } : null;
  const pdfImages = [posterImage, logoImage].filter(Boolean);

  let page1 = "";
  page1 += pdfRect(0, 0, 595, 842, "#050914");
  page1 += pdfRect(46, 54, 503, 734, "#101827");
  page1 += pdfRect(46, 714, 503, 74, "#0b1220");
  page1 += pdfRect(46, 54, 503, 10, "#facc15");
  if (logoImage) page1 += pdfDrawImage("ImLogo", 68, 718, 98, 66);
  else page1 += pdfWriteText("CINE CRUZEIRO", 78, 758, 15, { bold: true, color: "#facc15" });
  page1 += pdfWriteText("Ingresso digital", logoImage ? 184 : 78, 744, 11, { color: "#bfdbfe" });
  page1 += pdfWriteText(ticketStatusLabel(enriched.status).toUpperCase(), 434, 752, 11, { bold: true, color: "#facc15" });
  page1 += pdfRect(78, 390, 180, 270, "#0b1220");
  if (posterImage) page1 += pdfDrawImage("ImPoster", 86, 402, 164, 246);
  else page1 += pdfWriteMultiline(enriched.movieTitle, 104, 550, 18, { bold: true, color: "#ffffff", maxChars: 13, maxLines: 5, lineHeight: 22 });
  page1 += pdfWriteText("FILME", 286, 650, 9, { bold: true, color: "#60a5fa" });
  page1 += pdfWriteMultiline(enriched.movieTitle, 286, 612, 22, { bold: true, color: "#ffffff", maxChars: 21, maxLines: 3, lineHeight: 26 });
  page1 += pdfWriteText(`${sessionDate} as ${enriched.sessionTime}`, 286, 512, 16, { bold: true, color: "#facc15" });
  page1 += pdfWriteMultiline(formatLine, 286, 488, 10, { color: "#cbd5e1", maxChars: 38, maxLines: 2, lineHeight: 14 });
  page1 += pdfRect(286, 406, 154, 54, "#facc15");
  page1 += pdfWriteText("POLTRONA", 300, 444, 8, { bold: true, color: "#422006" });
  page1 += pdfWriteText(seatLabel, 300, 420, 17, { bold: true, color: "#020617" });
  if (enriched.paymentSource === "subscription_credit") {
    page1 += pdfWriteText(`INGRESSO No ${enriched.ticketNumber || "-"}`, 452, 420, 8, { bold: true, color: "#93c5fd" });
    page1 += pdfWriteText(`Valor: ${brl(enriched.basePrice)}`, 286, 382, 9, { color: "#ffffff" });
    page1 += pdfWriteText(`Credito Clube: -${brl(enriched.subscriptionCreditAmount)}`, 286, 366, 9, { bold: true, color: "#45d6a1" });
    page1 += pdfWriteText(`Complemento: ${brl(enriched.additionalPaymentAmount)}`, 286, 350, 9, { color: "#facc15" });
  }
  page1 += pdfLine(78, enriched.paymentSource === "subscription_credit" ? 330 : 354, 517, enriched.paymentSource === "subscription_credit" ? 330 : 354, "#334155", 1);
  page1 += pdfWriteText("QR Code de entrada", 214, enriched.paymentSource === "subscription_credit" ? 306 : 324, 10, { bold: true, color: "#bfdbfe" });
  if (showTicketAccess) {
    page1 += pdfQr(enriched.displayQrPayload || enriched.qrPayload || enriched.code, 222, 148, 164);
    page1 += pdfWriteCenteredText(enriched.displayCode || enriched.code, 304, 126, 10, { bold: true, color: "#facc15" });
    page1 += pdfWriteCenteredText("Apresente este codigo na entrada.", 304, 103, 11, { bold: true, color: "#ffffff" });
  } else {
    page1 += pdfRect(222, 148, 164, 164, "#e2e8f0");
    page1 += pdfWriteCenteredText(ticketStatusLabel(enriched.status).toUpperCase(), 304, 232, 14, { bold: true, color: "#334155" });
    page1 += pdfWriteCenteredText("QR Code desativado", 304, 208, 10, { color: "#64748b" });
  }
  page1 += pdfWriteText("Pagina 1 de 2", 462, 76, 9, { color: "#94a3b8" });

  let page2 = "";
  page2 += pdfRect(0, 0, 595, 842, "#050914");
  page2 += pdfRect(46, 54, 503, 734, "#101827");
  page2 += pdfRect(46, 714, 503, 74, "#0b1220");
  page2 += pdfRect(46, 54, 503, 10, "#facc15");
  if (logoImage) page2 += pdfDrawImage("ImLogo", 68, 718, 98, 66);
  else page2 += pdfWriteText("CINE CRUZEIRO", 78, 758, 15, { bold: true, color: "#facc15" });
  page2 += pdfWriteText("Detalhes do ingresso", logoImage ? 184 : 78, 744, 11, { color: "#bfdbfe" });
  page2 += pdfWriteMultiline(enriched.movieTitle, 78, 672, 20, { bold: true, color: "#ffffff", maxChars: 34, maxLines: 2, lineHeight: 24 });
  page2 += pdfWriteText(`${sessionDate} as ${enriched.sessionTime}`, 78, 608, 14, { bold: true, color: "#facc15" });
  page2 += pdfLine(78, 574, 517, 574, "#334155", 1);
  if (showTicketAccess) page2 += pdfWriteValueBlock("CODIGO", enriched.displayCode || enriched.code, 78, 538, { valueSize: 12, maxChars: 16, maxLines: 1 });
  page2 += pdfWriteValueBlock("PEDIDO", enriched.orderReference || enriched.orderId || "-", 78, 462, { valueSize: 10, maxChars: 48, maxLines: 3, boldValue: false });
  page2 += pdfWriteValueBlock("TIPO", enriched.ticketType || "Ingresso", 338, 538, { valueSize: 13, maxChars: 20, maxLines: 1 });
  page2 += pdfWriteValueBlock("SALA", enriched.sessionRoom || "Cine Cruzeiro", 338, 462, { valueSize: 11, maxChars: 28, maxLines: 2 });
  page2 += pdfWriteValueBlock("ASSENTO", seatLabel, 338, 390, { valueSize: 13, maxChars: 20, maxLines: 1 });
  page2 += pdfWriteValueBlock("NOME", enriched.customerName || "Cliente", 78, 390, { valueSize: 11, maxChars: 30, maxLines: 2 });
  if (enriched.paymentSource === "subscription_credit") {
    page2 += pdfWriteValueBlock("ORIGEM", "Credito Clube", 338, 326, { valueSize: 11, maxChars: 24, maxLines: 1 });
  }
  page2 += pdfLine(78, 344, 517, 344, "#334155", 1);
  page2 += pdfWriteText("BOMBONIERE", 78, 306, 9, { bold: true, color: "#facc15" });
  page2 += pdfWriteMultiline(extras || "Sem extras comprados neste pedido.", 78, 282, 11, { color: "#cbd5e1", maxChars: 72, maxLines: 5, lineHeight: 15 });
  page2 += pdfWriteText("INFORMACOES UTEIS", 78, 178, 9, { bold: true, color: "#60a5fa" });
  page2 += pdfWriteText(showTicketAccess ? "Apresente o QR Code da primeira pagina na entrada." : "O QR Code deste ingresso nao esta mais disponivel.", 78, 152, 10, { color: "#ffffff" });
  page2 += pdfWriteText("Chegue com 15 minutos de antecedencia.", 78, 134, 10, { color: "#cbd5e1" });
  page2 += pdfWriteText("A validade depende do status real no servidor do Cine Cruzeiro.", 78, 116, 10, { color: "#cbd5e1" });
  page2 += pdfWriteText("Pagina 2 de 2", 462, 86, 9, { color: "#94a3b8" });
  return buildPdf([page1, page2], { images: pdfImages });
}

  return { pdfRect, pdfLine, pdfWriteText, brl, buildPdf,
    ticketThermalPdf, concessionThermalPdf, ticketDownloadPdf };
}

module.exports = { createTicketDocumentPdfService };
