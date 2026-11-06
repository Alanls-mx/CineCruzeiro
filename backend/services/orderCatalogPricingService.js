function createOrderCatalogPricingService({
  todayIsoDate,
  sessionSalesOpenAt,
  isSessionSellable,
  resolveOrderTicketItems,
  roomForSession,
  roomSeatSelectionEnabled,
  roomSeats,
  orderTicketCount,
  concessionStockConsumption,
  finiteStock,
  applyCouponPricing,
  prioritizeClubCreditsInCouponPricing,
  allocateDiscountAcrossAmounts,
  roomDisplayLabel,
  ensureFriendlyOrderReference,
  assignSeatsToOrder,
}) {
function repriceOrderFromCatalog(db, order, options = {}) {
  const movie = db.movies.find((item) => item.id === order.movieId);
  if (!movie) {
    const error = new Error("Filme nao encontrado para este pedido.");
    error.statusCode = 400;
    throw error;
  }
  const session = (movie.sessions || []).find((item) => item.id === order.sessionId);
  if (!session || session.status === "sold_out") {
    const error = new Error(session ? "Esta sessão está esgotada." : "Esta sessão já terminou ou não está mais disponível.");
    error.statusCode = session ? 409 : 404;
    error.code = session ? "SESSION_SOLD_OUT" : "SESSION_NOT_FOUND";
    throw error;
  }
  const sessionDate = order.sessionDate || session.date || todayIsoDate();
  const salesOpenAt = sessionSalesOpenAt(session, sessionDate);
  if (salesOpenAt && salesOpenAt.getTime() > Date.now()) {
    const error = new Error("As vendas desta sessão serão abertas automaticamente 24 horas antes da pré-estreia.");
    error.statusCode = 409;
    error.code = "SESSION_SALES_NOT_OPEN";
    throw error;
  }
  if (!isSessionSellable(session, sessionDate)) {
    const error = new Error("Esta sessão já iniciou e não está mais disponível para venda.");
    error.statusCode = 409;
    error.code = "SESSION_SALES_CLOSED";
    throw error;
  }

  const ticketItems = resolveOrderTicketItems(db, order, session);
  const requestedTickets = ticketItems.reduce((sum, item) => sum + Number(item.ticketQuantity || item.quantity || 0), 0);
  if (requestedTickets <= 0) {
    const error = new Error("Selecione pelo menos um ingresso.");
    error.statusCode = 400;
    throw error;
  }
  const sessionRoom = roomForSession(db, session);
  const roomCapacity = roomSeatSelectionEnabled(sessionRoom)
    ? roomSeats(sessionRoom).filter((seat) => seat.enabled !== false).length
    : Number(sessionRoom?.capacity || 120);
  const paidTickets = (db.tickets || []).filter((ticket) =>
    ticket.sessionId === session.id && !["cancelled", "refunded"].includes(ticket.status)
  ).length;
  const reservedTickets = (db.orders || []).filter((existingOrder) =>
    existingOrder.sessionId === session.id &&
    existingOrder.status === "pending_payment" &&
    (!existingOrder.reservationExpiresAt || new Date(existingOrder.reservationExpiresAt).getTime() > Date.now())
  ).reduce((sum, existingOrder) => sum + orderTicketCount(existingOrder), 0);
  if (paidTickets + reservedTickets + requestedTickets > roomCapacity) {
    const error = new Error("Esta sessao nao possui lugares suficientes para a quantidade escolhida.");
    error.statusCode = 409;
    throw error;
  }

  const ticketTotal = ticketItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const concessionItems = (order.concessionItems || [])
    .map((item) => {
      const concession = db.concessions.find((catalogItem) => catalogItem.id === item.id && catalogItem.active !== false);
      if (!concession) {
        const error = new Error(`Produto indisponivel na bomboniere: ${item.name || item.id}`);
        error.statusCode = 400;
        throw error;
      }
      const quantity = Math.max(0, Math.min(Number(item.quantity || 0), Number(concession.maxPerOrder || 8)));
      const stockDeduction = concessionStockConsumption(concession, null, quantity);
      if (finiteStock(concession) && stockDeduction > Number(concession.stock || 0)) {
        const error = new Error(`${concession.name} nao possui estoque suficiente.`);
        error.statusCode = 409;
        throw error;
      }
      return {
        id: concession.id,
        sku: concession.sku,
        name: concession.name,
        category: concession.category,
        imageUrl: concession.imageUrl,
        quantity,
        stockDeduction,
        stockUnit: concession.stockUnit || "unit",
        usagePerSale: Number(concession.usagePerSale || 1),
        unitPrice: Number(concession.price || 0)
      };
    })
    .filter((item) => item.quantity > 0);

  const pricedItems = concessionItems;
  const concessionTotal = pricedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const initialCouponPricing = applyCouponPricing(db, order, ticketTotal, concessionTotal);
  const couponPricing = prioritizeClubCreditsInCouponPricing(db, order, ticketItems, ticketTotal, concessionTotal, initialCouponPricing);
  const concessionCouponAllocations = allocateDiscountAcrossAmounts(
    pricedItems.map((item) => item.quantity * item.unitPrice),
    couponPricing.concessionDiscount
  );
  const couponAdjustedItems = pricedItems.map((item, index) => ({
    ...item,
    couponDiscount: concessionCouponAllocations[index] || 0
  }));
  const discountValue = couponPricing.discountValue;
  const totalPrice = Math.max(0, Number((ticketTotal + concessionTotal - discountValue).toFixed(2)));

  const pricedOrder = {
    ...order,
    movieTitle: movie.title,
    sessionTime: session.time,
    sessionDate: session.date || order.sessionDate || todayIsoDate(),
    sessionFormat: session.format,
    sessionRoom: roomDisplayLabel(sessionRoom) || session.room || "Sala Cruzeiro",
    fullTicketsCount: Math.max(0, Number(order.fullTicketsCount || 0)),
    halfTicketsCount: Math.max(0, Number(order.halfTicketsCount || 0)),
    ticketItems,
    concessionItems: couponAdjustedItems,
    includeComboUpsell: couponAdjustedItems.length > 0,
    comboUpsellQuantity: couponAdjustedItems.reduce((sum, item) => sum + item.quantity, 0),
    discountValue,
    couponId: couponPricing.coupon?.id || "",
    couponCode: couponPricing.coupon?.couponCode || "",
    couponTitle: couponPricing.coupon?.title || "",
    couponDiscount: discountValue,
    couponOriginalDiscount: Number(couponPricing.originalDiscountValue ?? discountValue),
    couponAppliedAfterClubCredits: couponPricing.appliedAfterClubCredits === true,
    couponTicketDiscount: couponPricing.ticketDiscount,
    couponConcessionDiscount: couponPricing.concessionDiscount,
    couponAllowsClubStacking: couponPricing.coupon?.allowClubStacking === true,
    totalPrice
  };
  ensureFriendlyOrderReference(db, pricedOrder, movie);
  return options.assignSeats === false ? pricedOrder : assignSeatsToOrder(db, pricedOrder, session);
}

function repriceConcessionCounterOrder(db, order) {
  const concessionItems = (Array.isArray(order.concessionItems) ? order.concessionItems : [])
    .map((item) => {
      const concession = (db.concessions || []).find((catalogItem) => catalogItem.id === item.id && catalogItem.active !== false);
      if (!concession) {
        throw Object.assign(new Error(`Produto indisponivel na bomboniere: ${item.name || item.id}`), { statusCode: 400, code: "CONCESSION_UNAVAILABLE" });
      }
      const quantity = Math.max(0, Math.min(Math.floor(Number(item.quantity || 0)), Math.max(1, Number(concession.maxPerOrder || 8))));
      const stockDeduction = concessionStockConsumption(concession, null, quantity);
      if (finiteStock(concession) && stockDeduction > Number(concession.stock || 0)) {
        throw Object.assign(new Error(`${concession.name} nao possui estoque suficiente.`), { statusCode: 409, code: "CONCESSION_STOCK_UNAVAILABLE" });
      }
      const unitPrice = Number(concession.price || 0);
      return {
        id: concession.id,
        sku: concession.sku,
        name: concession.name,
        category: concession.category,
        imageUrl: concession.imageUrl,
        quantity,
        stockDeduction,
        stockUnit: concession.stockUnit || "unit",
        usagePerSale: Number(concession.usagePerSale || 1),
        originalPrice: unitPrice,
        finalPrice: unitPrice,
        unitPrice
      };
    })
    .filter((item) => item.quantity > 0);
  if (!concessionItems.length) {
    throw Object.assign(new Error("Selecione pelo menos um item da bomboniere."), { statusCode: 422, code: "CONCESSION_ITEMS_REQUIRED" });
  }
  const totalPrice = Number(concessionItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2));
  if (totalPrice <= 0) {
    throw Object.assign(new Error("A venda precisa ter valor maior que zero."), { statusCode: 422, code: "CONCESSION_TOTAL_REQUIRED" });
  }
  const sessionTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
  const pricedOrder = {
    ...order,
    movieId: "",
    sessionId: "",
    movieTitle: "Venda presencial da bomboniere",
    sessionDate: todayIsoDate(),
    sessionTime,
    sessionFormat: "",
    sessionRoom: "Balcao da bomboniere",
    ticketItems: [],
    fullTicketsCount: 0,
    halfTicketsCount: 0,
    concessionItems,
    includeComboUpsell: true,
    comboUpsellQuantity: concessionItems.reduce((sum, item) => sum + item.quantity, 0),
    discountValue: 0,
    totalPrice
  };
  ensureFriendlyOrderReference(db, pricedOrder);
  return pricedOrder;
}

function assertClientPricingMatches(input, pricedOrder) {
  const mismatch = (received, expected) => Number.isFinite(received) && Math.abs(received - expected) > 0.009;
  const providedMoney = (record, keys) => {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record || {}, key) || record[key] === "" || record[key] == null) continue;
      const value = Number(record[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  const fail = () => {
    const error = new Error("Os valores enviados não correspondem ao catálogo atual. Atualize o checkout e tente novamente.");
    error.statusCode = 409;
    error.code = "CLIENT_PRICE_MISMATCH";
    throw error;
  };

  const totalHint = providedMoney(input, ["total", "totalPrice", "amount"]);
  if (totalHint !== null && mismatch(totalHint, Number(pricedOrder.totalPrice || 0))) fail();

  const ticketPrices = new Map((pricedOrder.ticketItems || []).map((item) => [String(item.id), Number(item.unitPrice || 0)]));
  for (const item of Array.isArray(input?.ticketItems) ? input.ticketItems : []) {
    const id = String(item.id || item.ticketTypeId || "");
    const priceHint = providedMoney(item, ["unitPrice", "price"]);
    if (priceHint !== null && (!ticketPrices.has(id) || mismatch(priceHint, ticketPrices.get(id)))) fail();
  }

  const concessionPrices = new Map((pricedOrder.concessionItems || []).map((item) => [String(item.id), Number(item.unitPrice || 0)]));
  for (const item of Array.isArray(input?.concessionItems) ? input.concessionItems : []) {
    const id = String(item.id || "");
    const priceHint = providedMoney(item, ["unitPrice", "price"]);
    if (priceHint !== null && (!concessionPrices.has(id) || mismatch(priceHint, concessionPrices.get(id)))) fail();
  }
}

  return { repriceOrderFromCatalog, repriceConcessionCounterOrder, assertClientPricingMatches };
}

module.exports = { createOrderCatalogPricingService };
