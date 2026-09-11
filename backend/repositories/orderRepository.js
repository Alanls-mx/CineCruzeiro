const { timedQuery, runMutation } = require("./repositorySupport");

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function groupItems(rows = []) {
  return rows.reduce((map, row) => {
    const items = map.get(row.order_id) || [];
    items.push(row);
    map.set(row.order_id, items);
    return map;
  }, new Map());
}

function mapOrder(row, itemRows = []) {
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const concessionItems = itemRows
    .filter((item) => ["concession", "addon", "promotion"].includes(item.item_type))
    .map((item) => ({
      ...(item.metadata || {}),
      id: item.item_id,
      name: item.name,
      quantity: Number(item.quantity),
      unitPrice: number(item.unit_price)
    }));
  const ticketRows = itemRows.filter((item) => item.item_type === "ticket");
  return {
    ...metadata,
    id: row.id,
    idempotencyKey: row.idempotency_key || metadata.idempotencyKey || "",
    customerUserId: row.customer_user_id || metadata.customerUserId || "",
    customerName: row.customer_name,
    customerEmail: row.customer_email || "",
    customerPhone: row.customer_phone || "",
    customerCpf: row.customer_cpf || "",
    movieId: row.movie_id || metadata.movieId || "",
    sessionId: row.session_id || metadata.sessionId || "",
    status: row.status,
    subtotal: number(row.subtotal),
    discountValue: number(row.discount_total),
    totalPrice: number(row.total),
    currency: row.currency || "BRL",
    reservationExpiresAt: iso(row.reservation_expires_at),
    serviceSubtotal: number(row.service_subtotal),
    goodsSubtotal: number(row.goods_subtotal),
    clubCreditsApplied: number(row.club_credits_applied),
    clubDiscount: number(row.club_discount),
    additionalPayment: number(row.additional_payment),
    serviceFiscalStatus: row.service_fiscal_status || "not_applicable",
    goodsFiscalStatus: row.goods_fiscal_status || "not_required",
    goodsFiscalTrigger: row.goods_fiscal_trigger || "goods_delivered",
    concessionItems,
    ticketItems: ticketRows.length
      ? ticketRows.map((item) => ({
          ...(item.metadata || {}),
          id: item.item_id,
          name: item.name,
          quantity: Number(item.quantity),
          unitPrice: number(item.unit_price)
        }))
      : Array.isArray(metadata.ticketItems) ? metadata.ticketItems : [],
    createdAt: iso(row.created_at) || metadata.createdAt || "",
    updatedAt: iso(row.updated_at) || metadata.updatedAt || ""
  };
}

async function loadItemRows(client, orderIds) {
  if (!orderIds.length) return new Map();
  const result = await timedQuery(client, `SELECT * FROM order_items
    WHERE order_id = ANY($1::text[])
    ORDER BY order_id, item_type, id`, [orderIds], { repository: "order", operation: "items.read" });
  return groupItems(result.rows);
}

async function hydrateRows(client, rows) {
  const items = await loadItemRows(client, rows.map((row) => row.id));
  return rows.map((row) => mapOrder(row, items.get(row.id) || []));
}

async function findByIdWithClient(client, id, { forUpdate = false } = {}) {
  const result = await timedQuery(client, `SELECT * FROM orders
    WHERE id = $1 OR idempotency_key = NULLIF($1, '')
    ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
    LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`, [String(id || "")], {
    repository: "order",
    operation: forUpdate ? "findByIdForUpdate" : "findById"
  });
  if (!result.rowCount) return null;
  return (await hydrateRows(client, result.rows))[0];
}

async function findById(id) {
  return findByIdWithClient(null, id);
}

async function findByIdempotencyKey(key) {
  const normalized = String(key || "").trim();
  if (!normalized) return null;
  const result = await timedQuery(null, "SELECT * FROM orders WHERE idempotency_key = $1 LIMIT 1", [normalized], {
    repository: "order",
    operation: "findByIdempotencyKey"
  });
  return result.rowCount ? (await hydrateRows(null, result.rows))[0] : null;
}

async function list() {
  const result = await timedQuery(null, "SELECT * FROM orders ORDER BY created_at DESC, id", [], {
    repository: "order",
    operation: "list"
  });
  return hydrateRows(null, result.rows);
}

function orderValues(order) {
  const total = number(order.totalPrice ?? order.total);
  const discount = number(order.discountValue ?? order.discountTotal);
  const subtotal = number(order.subtotal ?? (total + discount));
  return [
    order.id,
    String(order.customerUserId || "") || null,
    order.customerName || "Cliente Cine Cruzeiro",
    order.customerEmail || "",
    order.customerPhone || "",
    order.customerCpf || "",
    String(order.movieId || "") || null,
    String(order.sessionId || "") || null,
    order.status === "pix_pending" ? "pending_payment" : order.status || "pending_payment",
    subtotal,
    discount,
    total,
    order.currency || "BRL",
    order.reservationExpiresAt || null,
    String(order.idempotencyKey || "").trim() || null,
    number(order.serviceSubtotal),
    number(order.goodsSubtotal),
    number(order.clubCreditsApplied),
    number(order.clubDiscount),
    number(order.additionalPayment ?? total),
    order.serviceFiscalStatus || "not_applicable",
    order.goodsFiscalStatus || "not_required",
    order.goodsFiscalTrigger || "goods_delivered",
    JSON.stringify(order),
    order.createdAt || null
  ];
}

async function replaceOrderItems(client, order) {
  await timedQuery(client, "DELETE FROM order_items WHERE order_id = $1", [order.id], {
    repository: "order",
    operation: "items.replace.delete"
  });
  const items = [
    ...(Array.isArray(order.ticketItems) ? order.ticketItems.map((item) => ({ ...item, itemType: "ticket" })) : []),
    ...(Array.isArray(order.concessionItems) ? order.concessionItems.map((item) => ({
      ...item,
      itemType: item.category === "promocao" ? "promotion" : item.itemType === "addon" ? "addon" : "concession"
    })) : [])
  ];
  for (const item of items) {
    const quantity = Math.max(1, Math.floor(number(item.quantity || 1)));
    const unitPrice = Math.max(0, number(item.unitPrice));
    await timedQuery(client, `INSERT INTO order_items
      (order_id, item_type, item_id, name, quantity, unit_price, total_price, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [
      order.id,
      item.itemType,
      item.id,
      item.name || (item.itemType === "ticket" ? "Ingresso" : "Item"),
      quantity,
      unitPrice,
      number(item.totalPrice ?? quantity * unitPrice),
      JSON.stringify(item)
    ], { repository: "order", operation: "items.replace.insert" });
  }
}

async function replaceServiceItems(client, orderId, items = []) {
  await timedQuery(client, "DELETE FROM order_service_items WHERE order_id = $1", [orderId], {
    repository: "order",
    operation: "service_items.replace.delete"
  });
  for (const item of items) {
    await timedQuery(client, `INSERT INTO order_service_items
      (id, order_id, ticket_id, item_id, name, quantity, unit_price, base_price,
       subscription_credit_amount, additional_payment_amount, payment_source,
       subscription_credit_id, metadata, created_at)
      VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,$10,$11,NULLIF($12,''),$13::jsonb,
        COALESCE(NULLIF($14,'')::timestamptz, now()))`, [
      item.id,
      orderId,
      item.ticketId || "",
      item.itemId,
      item.name,
      Math.max(1, Math.floor(number(item.quantity || 1))),
      Math.max(0, number(item.unitPrice)),
      Math.max(0, number(item.basePrice)),
      Math.max(0, number(item.subscriptionCreditAmount)),
      Math.max(0, number(item.additionalPaymentAmount)),
      item.paymentSource || "standard",
      item.subscriptionCreditId || "",
      JSON.stringify(item.metadata || {}),
      item.createdAt || ""
    ], { repository: "order", operation: "service_items.replace.insert" });
  }
}

async function replaceGoodsItems(client, orderId, items = []) {
  await timedQuery(client, "DELETE FROM order_goods_items WHERE order_id = $1", [orderId], {
    repository: "order",
    operation: "goods_items.replace.delete"
  });
  for (const item of items) {
    await timedQuery(client, `INSERT INTO order_goods_items
      (id, order_id, concession_id, sku, name, quantity, original_unit_price,
       club_discount, final_unit_price, metadata, created_at)
      VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),$5,$6,$7,$8,$9,$10::jsonb,
        COALESCE(NULLIF($11,'')::timestamptz, now()))`, [
      item.id,
      orderId,
      item.concessionId || "",
      item.sku || "",
      item.name,
      Math.max(1, Math.floor(number(item.quantity || 1))),
      Math.max(0, number(item.originalUnitPrice)),
      Math.max(0, number(item.clubDiscount)),
      Math.max(0, number(item.finalUnitPrice)),
      JSON.stringify(item.metadata || {}),
      item.createdAt || ""
    ], { repository: "order", operation: "goods_items.replace.insert" });
  }
}

async function replaceRelatedItems(client, order, related = {}) {
  await replaceOrderItems(client, order);
  if (Object.prototype.hasOwnProperty.call(related, "serviceItems")) {
    await replaceServiceItems(client, order.id, related.serviceItems);
  }
  if (Object.prototype.hasOwnProperty.call(related, "goodsItems")) {
    await replaceGoodsItems(client, order.id, related.goodsItems);
  }
}

async function create(order, related = {}, options = {}) {
  return runMutation({
    event: "repository.order.create",
    metadata: { repository: "order", operation: "create", orderId: order.id },
    audit: options.audit
  }, async (client) => {
    const values = orderValues(order);
    const inserted = await timedQuery(client, `INSERT INTO orders
      (id, customer_user_id, customer_name, customer_email, customer_phone, customer_cpf,
       movie_id, session_id, status, subtotal, discount_total, total, currency,
       reservation_expires_at, idempotency_key, service_subtotal, goods_subtotal,
       club_credits_applied, club_discount, additional_payment, service_fiscal_status,
       goods_fiscal_status, goods_fiscal_trigger, metadata, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24::jsonb,COALESCE($25::timestamptz, now()),now())
      ON CONFLICT DO NOTHING
      RETURNING *`, values, { repository: "order", operation: "create.insert" });
    if (!inserted.rowCount) {
      const existing = await findByIdWithClient(client, order.id)
        || await findByIdWithClient(client, order.idempotencyKey);
      if (!existing) {
        const error = new Error("A referência idempotente do pedido já está em uso.");
        error.code = "ORDER_IDEMPOTENCY_CONFLICT";
        error.statusCode = 409;
        throw error;
      }
      return { order: existing, created: false };
    }
    await replaceRelatedItems(client, order, related);
    return { order: (await hydrateRows(client, inserted.rows))[0], created: true };
  });
}

async function update(order, related = {}, options = {}) {
  return runMutation({
    event: options.event || "repository.order.update",
    metadata: { repository: "order", operation: options.operation || "update", orderId: order.id },
    audit: options.audit
  }, async (client) => {
    const values = orderValues(order);
    values.push(options.expectedUpdatedAt || null);
    const result = await timedQuery(client, `UPDATE orders SET
      customer_user_id=$2, customer_name=$3, customer_email=$4, customer_phone=$5,
      customer_cpf=$6, movie_id=$7, session_id=$8, status=$9, subtotal=$10,
      discount_total=$11, total=$12, currency=$13, reservation_expires_at=$14,
      idempotency_key=$15, service_subtotal=$16, goods_subtotal=$17,
      club_credits_applied=$18, club_discount=$19, additional_payment=$20,
      service_fiscal_status=$21, goods_fiscal_status=$22, goods_fiscal_trigger=$23,
      metadata=$24::jsonb, updated_at=now()
      WHERE id=$1 AND ($26::timestamptz IS NULL OR updated_at=$26::timestamptz)
      RETURNING *`, values, { repository: "order", operation: options.operation || "update" });
    if (!result.rowCount) {
      const exists = await timedQuery(client, "SELECT 1 FROM orders WHERE id=$1", [order.id], {
        repository: "order",
        operation: "update.conflict_check"
      });
      const error = new Error(exists.rowCount ? "O pedido foi alterado por outra operação." : "Pedido não encontrado.");
      error.code = exists.rowCount ? "ORDER_CHANGED" : "ORDER_NOT_FOUND";
      error.statusCode = exists.rowCount ? 409 : 404;
      throw error;
    }
    if (options.replaceItems) await replaceRelatedItems(client, order, related);
    return (await hydrateRows(client, result.rows))[0];
  });
}

async function updateStatus(id, nextStatus, expectedStatuses = [], patch = {}, options = {}) {
  return runMutation({
    event: "repository.order.status_update",
    metadata: { repository: "order", operation: "updateStatus", orderId: id, status: nextStatus },
    audit: options.audit
  }, async (client) => {
    const current = await findByIdWithClient(client, id, { forUpdate: true });
    if (!current) {
      const error = new Error("Pedido não encontrado.");
      error.code = "ORDER_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }
    if (expectedStatuses.length && !expectedStatuses.includes(current.status)) {
      return { order: current, changed: false };
    }
    const next = { ...current, ...patch, status: nextStatus, updatedAt: new Date().toISOString() };
    const values = orderValues(next);
    const result = await timedQuery(client, `UPDATE orders SET
      status=$9, reservation_expires_at=$14, metadata=$24::jsonb, updated_at=now()
      WHERE id=$1 RETURNING *`, values, { repository: "order", operation: "updateStatus.write" });
    return { order: (await hydrateRows(client, result.rows))[0], changed: true };
  });
}

module.exports = {
  mapOrder,
  findById,
  findByIdempotencyKey,
  list,
  create,
  update,
  updateStatus,
  replaceOrderItems,
  replaceServiceItems,
  replaceGoodsItems
};
