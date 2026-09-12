#!/usr/bin/env node

const { Client } = require("pg");

const BATCH = "sim-admin-evaluation-v1";
const PREFIX = `${BATCH}-`;
const CONFIRMATION = "CINE_CRUZEIRO_SIMULATION";
const CUSTOMER_COUNT = 80;
const MOVIE_COUNT = 12;
const ORDER_COUNT = 180;

const movieNames = [
  "Horizonte de Neon",
  "A Ultima Sessao",
  "Operacao Eclipse",
  "Cartas do Amanhã",
  "O Reino Submerso",
  "Velocidade Lunar",
  "Segredos da Serra",
  "O Som do Silencio",
  "Destino Vermelho",
  "Depois da Tempestade",
  "A Cidade das Estrelas",
  "Cronicas do Infinito"
];

const customerFirstNames = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fabio", "Gabriela", "Henrique", "Isabela", "Joao"];
const customerLastNames = ["Almeida", "Barbosa", "Costa", "Dias", "Ferreira", "Gomes", "Lima", "Martins"];
const fallbackProducts = [
  ["Pipoca Grande", 18],
  ["Combo Classico", 25],
  ["Refrigerante 500ml", 9],
  ["Chocolate de Cinema", 8],
  ["Combo Familia", 42],
  ["Nachos com Queijo", 16]
];

function databaseUrl() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) throw new Error("Configure DATABASE_URL ou POSTGRES_URL.");
  return value;
}

function isoAtOffset(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysOffset);
  value.setUTCHours(value.getUTCHours() + hoursOffset);
  value.setUTCMinutes(value.getUTCMinutes() + minutesOffset);
  value.setUTCSeconds(0, 0);
  return value;
}

function cinemaDate(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function cinemaTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function metadata(extra = {}) {
  return JSON.stringify({ simulation: true, simulationBatchId: BATCH, ...extra });
}

async function cleanup(client) {
  const statements = [
    ["subscription_credit_redemptions", "DELETE FROM subscription_credit_redemptions WHERE id LIKE $1"],
    ["subscription_usage", "DELETE FROM subscription_usage WHERE id LIKE $1"],
    ["order_service_items", "DELETE FROM order_service_items WHERE id LIKE $1"],
    ["order_goods_items", "DELETE FROM order_goods_items WHERE id LIKE $1"],
    ["goods_fiscal_documents", "DELETE FROM goods_fiscal_documents WHERE id LIKE $1"],
    ["tickets", "DELETE FROM tickets WHERE id LIKE $1"],
    ["payments", "DELETE FROM payments WHERE id LIKE $1"],
    ["order_items", "DELETE FROM order_items WHERE order_id LIKE $1"],
    ["subscription_credit_units", "DELETE FROM subscription_credit_units WHERE id LIKE $1"],
    ["subscription_payments", "DELETE FROM subscription_payments WHERE id LIKE $1"],
    ["subscription_cycles", "DELETE FROM subscription_cycles WHERE id LIKE $1"],
    ["subscription_credits", "DELETE FROM subscription_credits WHERE id LIKE $1"],
    ["subscriptions", "DELETE FROM subscriptions WHERE id LIKE $1"],
    ["orders", "DELETE FROM orders WHERE id LIKE $1"],
    ["seat_holds", "DELETE FROM seat_holds WHERE session_id LIKE $1"],
    ["session_ticket_types", "DELETE FROM session_ticket_types WHERE session_id LIKE $1"],
    ["sessions", "DELETE FROM sessions WHERE id LIKE $1"],
    ["promotions", "DELETE FROM promotions WHERE id LIKE $1"],
    ["concession_inventory", "DELETE FROM concession_inventory WHERE concession_id LIKE $1"],
    ["concessions", "DELETE FROM concessions WHERE id LIKE $1"],
    ["movies", "DELETE FROM movies WHERE id LIKE $1"],
    ["rooms", "DELETE FROM rooms WHERE id LIKE $1"],
    ["users", "DELETE FROM users WHERE id LIKE $1"]
  ];
  const deleted = {};
  for (const [name, sql] of statements) {
    try {
      const result = await client.query(sql, [`${PREFIX}%`]);
      deleted[name] = result.rowCount;
    } catch (error) {
      if (error.code === "42P01") continue;
      throw error;
    }
  }
  return deleted;
}

async function seed(client) {
  await cleanup(client);
  const now = new Date();
  const rooms = [
    { id: `${PREFIX}room-1`, name: "[SIMULACAO] Sala Principal", capacity: 120, technology: "Laser 4K + Dolby 7.1" },
    { id: `${PREFIX}room-2`, name: "[SIMULACAO] Sala Premium", capacity: 80, technology: "Laser 2K + Dolby Atmos" },
    { id: `${PREFIX}room-3`, name: "[SIMULACAO] Sala Familia", capacity: 160, technology: "Projecao digital 2D" }
  ];
  for (const room of rooms) {
    await client.query(
      `INSERT INTO rooms (id, name, capacity, technology, status, seat_selection_enabled, seat_types, seat_layout)
       VALUES ($1,$2,$3,$4,'hidden',false,'[]'::jsonb,'{"screenLabel":"TELA","rows":[]}'::jsonb)`,
      [room.id, room.name, room.capacity, room.technology]
    );
  }

  const sourceMedia = await client.query(
    "SELECT poster_url, backdrop_url FROM movies WHERE status <> 'hidden' AND COALESCE(poster_url, '') <> '' ORDER BY updated_at DESC LIMIT 12"
  );
  const movies = [];
  const sessions = [];
  for (let index = 0; index < MOVIE_COUNT; index += 1) {
    const id = `${PREFIX}movie-${String(index + 1).padStart(2, "0")}`;
    const media = sourceMedia.rows[index % Math.max(1, sourceMedia.rows.length)] || {};
    const movie = {
      id,
      title: `[SIMULACAO] ${movieNames[index]}`,
      duration: `${96 + (index % 6) * 11} min`,
      rating: ["L", "10", "12", "14", "16"][index % 5],
      posterUrl: media.poster_url || "",
      backdropUrl: media.backdrop_url || ""
    };
    movies.push(movie);
    await client.query(
      `INSERT INTO movies (id, slug, workflow_status, sort_order, status, title, original_title, synopsis, duration, director,
        metadata, genre, rating, poster_url, backdrop_url, release_date, auto_publish, is_highlight, tag)
       VALUES ($1,$2,'draft',$3,'hidden',$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::date,false,false,$15)`,
      [id, id, 900 + index, movie.title, movieNames[index], "Conteudo sintetico criado exclusivamente para avaliar o painel administrativo.",
        movie.duration, "Equipe de demonstracao", metadata({ entity: "movie" }), [index % 2 ? "Drama" : "Aventura", "Cinema"], movie.rating,
        movie.posterUrl, movie.backdropUrl, cinemaDate(isoAtOffset(index - 3)), "Simulacao"]
    );

    for (let slot = 0; slot < 4; slot += 1) {
      const sessionIndex = index * 4 + slot;
      let startsAt;
      if (sessionIndex === 0) startsAt = isoAtOffset(0, 0, -30);
      else if (sessionIndex < 8) startsAt = isoAtOffset(0, Math.floor(sessionIndex / 2) + 1, (sessionIndex % 2) * 20);
      else startsAt = isoAtOffset(1 + (sessionIndex % 7), 10 + (slot * 2) - now.getUTCHours(), 0);
      const session = {
        id: `${PREFIX}session-${String(sessionIndex + 1).padStart(3, "0")}`,
        movieId: id,
        room: rooms[sessionIndex % rooms.length],
        startsAt,
        time: cinemaTime(startsAt),
        date: cinemaDate(startsAt),
        format: sessionIndex % 3 === 0 ? "2D Dublado" : sessionIndex % 3 === 1 ? "2D Legendado" : "3D Dublado"
      };
      sessions.push(session);
      await client.query(
        `INSERT INTO sessions (id, movie_id, room_id, starts_at, time_label, room_label, format, price_full, price_half, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [session.id, id, session.room.id, startsAt.toISOString(), session.time, session.room.name, session.format,
          20 + (sessionIndex % 4) * 5, 10 + (sessionIndex % 4) * 2.5,
          sessionIndex % 9 === 0 ? "filling_fast" : sessionIndex % 17 === 0 ? "sold_out" : "available"]
      );
    }
  }

  const users = [];
  for (let index = 0; index < CUSTOMER_COUNT; index += 1) {
    const id = `${PREFIX}user-${String(index + 1).padStart(3, "0")}`;
    const name = `[SIMULACAO] ${customerFirstNames[index % customerFirstNames.length]} ${customerLastNames[index % customerLastNames.length]} ${index + 1}`;
    const createdAt = isoAtOffset(-(index % 75), -(index % 18));
    users.push({ id, name, email: `simulacao.${index + 1}@example.invalid`, createdAt });
    await client.query(
      `INSERT INTO users (id, name, email, phone, password_hash, auth_provider, email_verified, email_unsubscribed_at, role, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'','email',false,now(),'customer',false,$5,$5)`,
      [id, name, `simulacao.${index + 1}@example.invalid`, `+5500000${String(index + 1).padStart(4, "0")}`, createdAt.toISOString()]
    );
  }

  let products = (await client.query(
    "SELECT id, name, price, sku FROM concessions WHERE active = true ORDER BY featured DESC, sort_order, name LIMIT 8"
  )).rows.map((item) => ({ id: item.id, name: item.name, price: Number(item.price), sku: item.sku || "" }));
  if (!products.length) {
    for (let index = 0; index < fallbackProducts.length; index += 1) {
      const [name, price] = fallbackProducts[index];
      const id = `${PREFIX}concession-${index + 1}`;
      await client.query(
        `INSERT INTO concessions (id, sku, name, description, price, category, featured, sort_order, tags, combo_items, active)
         VALUES ($1,$2,$3,'Produto sintetico para avaliacao do painel.',$4,'combo',false,$5,'{simulacao}','[]'::jsonb,false)`,
        [id, `SIM-${index + 1}`, `[SIMULACAO] ${name}`, price, 900 + index]
      );
      await client.query("INSERT INTO concession_inventory (concession_id, available, reserved, sold) VALUES ($1,25,0,0)", [id]);
      products.push({ id, name: `[SIMULACAO] ${name}`, price, sku: `SIM-${index + 1}` });
    }
  }

  await client.query(
    `INSERT INTO promotions (id, title, description, discount_type, value, coupon_code, starts_at, ends_at, active, metadata)
     VALUES ($1,'[SIMULACAO] Semana do Cinema','Cupom sintetico sem validade comercial.','percentage',15,'SIMPAINEL15',$2,$3,false,$4::jsonb)`,
    [`${PREFIX}promotion-1`, isoAtOffset(-15).toISOString(), isoAtOffset(15).toISOString(), metadata({ appliesTo: "all" })]
  );

  const paidOrders = [];
  const ticketsByOrder = new Map();
  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const id = `${PREFIX}order-${String(index + 1).padStart(4, "0")}`;
    const user = users[index % users.length];
    const session = sessions[index % sessions.length];
    const movie = movies.find((item) => item.id === session.movieId);
    const ticketQuantity = 1 + (index % 4);
    const ticketUnitPrice = 20 + (index % 4) * 5;
    const ticketGross = ticketQuantity * ticketUnitPrice;
    const itemCount = index % 5 === 0 ? 0 : 1 + (index % 3);
    const concessionItems = [];
    let concessionGross = 0;
    let concessionClubDiscount = 0;
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const product = products[(index + itemIndex) % products.length];
      const quantity = 1 + ((index + itemIndex) % 2);
      const originalPrice = money(product.price || 10);
      const clubDiscount = index % 7 === 0 ? money(originalPrice * quantity * 0.15) : 0;
      concessionGross += originalPrice * quantity;
      concessionClubDiscount += clubDiscount;
      concessionItems.push({
        id: product.id,
        concessionId: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        originalPrice,
        unitPrice: money(originalPrice - clubDiscount / quantity),
        finalPrice: money(originalPrice - clubDiscount / quantity),
        clubDiscount,
        fulfilledQuantity: index % 6 === 0 ? quantity : 0
      });
    }
    const couponDiscount = index % 11 === 0 ? money(Math.min(12, (ticketGross + concessionGross - concessionClubDiscount) * 0.15)) : 0;
    const subtotal = money(ticketGross + concessionGross);
    const total = money(Math.max(0, subtotal - concessionClubDiscount - couponDiscount));
    const status = index % 20 === 0 ? "refunded"
      : index % 13 === 0 ? "cancelled"
      : index % 9 === 0 ? "pending_payment"
      : index % 17 === 0 ? "expired"
      : "paid";
    const createdAt = index < 32 ? isoAtOffset(0, -(index % 12), -(index % 50)) : isoAtOffset(-(1 + (index % 29)), -(index % 18));
    const paymentMethod = index % 4 === 0 ? "credit_card" : index % 4 === 1 ? "pix" : index % 4 === 2 ? "cash" : "card_terminal";
    const paymentStatus = status === "paid" ? "approved" : status === "refunded" ? "refunded" : status === "pending_payment" ? "pending" : status;
    const ticketItems = [{ id: "sim-ticket-normal", name: index % 3 === 0 ? "Meia Entrada" : "Ingresso normal", quantity: ticketQuantity, ticketQuantity, unitPrice: ticketUnitPrice }];
    const orderMetadata = {
      simulation: true,
      simulationBatchId: BATCH,
      movieId: movie.id,
      movieTitle: movie.title,
      sessionId: session.id,
      sessionDate: session.date,
      sessionTime: session.time,
      sessionRoom: session.room.name,
      sessionFormat: session.format,
      customerUserId: user.id,
      origin: index % 5 === 0 ? "box_office" : "online",
      paymentMethod,
      paymentStatus,
      paidAt: status === "paid" ? createdAt.toISOString() : "",
      ticketItems,
      concessionItems,
      couponId: couponDiscount ? `${PREFIX}promotion-1` : "",
      couponCode: couponDiscount ? "SIMPAINEL15" : "",
      couponDiscount,
      couponTicketDiscount: couponDiscount,
      couponConcessionDiscount: 0,
      clubBenefits: { ticketDiscount: 0, concessionDiscount: concessionClubDiscount, freeConcessionDiscount: 0 },
      seatIds: Array.from({ length: ticketQuantity }, (_, seat) => `${String.fromCharCode(65 + (index % 10))}${seat + 1}`)
    };
    await client.query(
      `INSERT INTO orders (id, customer_user_id, customer_name, customer_email, customer_phone, movie_id, session_id, status,
        subtotal, discount_total, total, reservation_expires_at, idempotency_key, service_subtotal, goods_subtotal,
        club_credits_applied, club_discount, additional_payment, service_fiscal_status, goods_fiscal_status, goods_fiscal_trigger,
        metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,$16,$11,'not_applicable',$17,'goods_delivered',$18::jsonb,$19,$19)`,
      [id, user.id, user.name, user.email, user.phone || "", movie.id, session.id, status, subtotal,
        money(concessionClubDiscount + couponDiscount), total,
        status === "pending_payment" ? isoAtOffset(0, 0, 25).toISOString() : null, `${PREFIX}idem-order-${index + 1}`,
        ticketGross, money(concessionGross - concessionClubDiscount), concessionClubDiscount,
        "not_required",
        JSON.stringify(orderMetadata), createdAt.toISOString()]
    );
    await client.query(
      `INSERT INTO order_items (order_id, item_type, item_id, name, quantity, unit_price, total_price, metadata)
       VALUES ($1,'ticket',$2,$3,$4,$5,$6,$7::jsonb)`,
      [id, ticketItems[0].id, ticketItems[0].name, ticketQuantity, ticketUnitPrice, ticketGross, metadata(ticketItems[0])]
    );
    for (const item of concessionItems) {
      await client.query(
        `INSERT INTO order_items (order_id, item_type, item_id, name, quantity, unit_price, total_price, metadata)
         VALUES ($1,'concession',$2,$3,$4,$5,$6,$7::jsonb)`,
        [id, item.id, item.name, item.quantity, item.unitPrice, money(item.quantity * item.unitPrice), metadata(item)]
      );
      await client.query(
        `INSERT INTO order_goods_items (id, order_id, concession_id, sku, name, quantity, original_unit_price, club_discount, final_unit_price, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [`${PREFIX}goods-${index}-${item.id.slice(-8)}`, id, item.id, item.sku, item.name, item.quantity, item.originalPrice,
          item.clubDiscount, item.finalPrice, metadata(), createdAt.toISOString()]
      );
    }
    const paymentId = `${PREFIX}payment-${String(index + 1).padStart(4, "0")}`;
    await client.query(
      `INSERT INTO payments (id, order_id, method, provider, provider_payment_id, provider_reference, status, amount, currency,
        created_at, updated_at, approved_at, expired_at, cancelled_at, refunded_at, metadata)
       VALUES ($1,$2,$3,'admin',$4,$5,$6,$7,'BRL',$8,$8,$9,$10,$11,$12,$13::jsonb)`,
      [paymentId, id, paymentMethod, `${PREFIX}provider-${index + 1}`, `${PREFIX}reference-${index + 1}`, paymentStatus, total,
        createdAt.toISOString(), paymentStatus === "approved" ? createdAt.toISOString() : null,
        paymentStatus === "expired" ? createdAt.toISOString() : null,
        paymentStatus === "cancelled" ? createdAt.toISOString() : null,
        paymentStatus === "refunded" ? createdAt.toISOString() : null,
        metadata({ nonRefundableSimulation: true })]
    );

    if (["paid", "refunded"].includes(status)) {
      paidOrders.push({ id, user, session, movie, createdAt, ticketGross });
      const generatedTickets = [];
      for (let ticketIndex = 0; ticketIndex < ticketQuantity; ticketIndex += 1) {
        const ticketId = `${PREFIX}ticket-${String(index + 1).padStart(4, "0")}-${ticketIndex + 1}`;
        const ticketStatus = status === "refunded" ? "refunded" : index % 6 === 0 ? "used" : "active";
        await client.query(
          `INSERT INTO tickets (id, order_id, movie_id, session_id, code, qr_payload, ticket_type, status, customer_name,
            customer_email, customer_phone, source, used_at, used_by, base_price, subscription_credit_amount,
            additional_payment_amount, payment_source, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,$15,'standard',$16::jsonb,$17)`,
          [ticketId, id, movie.id, session.id, `SIM-${index + 1}-${ticketIndex + 1}`, `SIMULATION:${BATCH}:${ticketId}`,
            ticketItems[0].name, ticketStatus, user.name, user.email, user.phone || "", index % 5 === 0 ? "box_office" : "online",
            ticketStatus === "used" ? createdAt.toISOString() : null, ticketStatus === "used" ? "simulacao" : "",
            ticketUnitPrice, metadata({ movieTitle: movie.title, sessionDate: session.date, sessionTime: session.time }), createdAt.toISOString()]
        );
        generatedTickets.push(ticketId);
      }
      ticketsByOrder.set(id, generatedTickets);
    }
  }

  const plan = (await client.query("SELECT id, monthly_price FROM subscription_plans WHERE active = true ORDER BY monthly_price LIMIT 1")).rows[0];
  if (plan) {
    for (let index = 0; index < 16; index += 1) {
      const user = users[index];
      const subscriptionId = `${PREFIX}subscription-${index + 1}`;
      const cycleId = `${PREFIX}cycle-${index + 1}`;
      const cycleStart = isoAtOffset(-(index % 20));
      const cycleEnd = isoAtOffset(30 - (index % 20));
      await client.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, provider, payment_status, approved_at, cycle_start, cycle_end,
          next_billing_at, started_at, current_period_key, current_period_start, current_period_end, credits_available,
          credits_used, external_billing_pending, history, created_at, updated_at)
         VALUES ($1,$2,$3,'active','manual_admin','approved',$4,$4,$5,$5,$4,$6,$4,$5,$7,$8,false,$9::jsonb,$4,$4)`,
        [subscriptionId, user.id, plan.id, cycleStart.toISOString(), cycleEnd.toISOString(), cinemaDate(cycleStart).slice(0, 7), 4 - (index % 3), index % 3, metadata()]
      );
      await client.query(
        `INSERT INTO subscription_cycles (id, subscription_id, customer_id, plan_id, cycle_start, cycle_end, status,
          source_payment_id, idempotency_key, plan_snapshot, accounting_snapshot, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9::jsonb,$10::jsonb,$5,$5)`,
        [cycleId, subscriptionId, user.id, plan.id, cycleStart.toISOString(), cycleEnd.toISOString(), `${PREFIX}club-payment-${index + 1}`,
          `${PREFIX}idem-cycle-${index + 1}`, metadata({ monthlyPrice: Number(plan.monthly_price) }), metadata()]
      );
      await client.query(
        `INSERT INTO subscription_payments (id, subscription_id, cycle_id, customer_id, provider, provider_payment_id, amount,
          currency, status, idempotency_key, approved_at, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'simulation',$5,$6,'BRL','approved',$7,$8,$9::jsonb,$8,$8)`,
        [`${PREFIX}club-payment-${index + 1}`, subscriptionId, cycleId, user.id, `${PREFIX}club-provider-${index + 1}`,
          Number(plan.monthly_price), `${PREFIX}idem-club-payment-${index + 1}`, cycleStart.toISOString(), metadata()]
      );
    }
  }

  return {
    batch: BATCH,
    users: users.length,
    rooms: rooms.length,
    movies: movies.length,
    sessions: sessions.length,
    orders: ORDER_COUNT,
    payments: ORDER_COUNT,
    tickets: [...ticketsByOrder.values()].reduce((sum, list) => sum + list.length, 0),
    subscriptions: plan ? 16 : 0,
    reusedConcessionProducts: !products.some((item) => item.id.startsWith(PREFIX))
  };
}

async function status(client) {
  const checks = {
    users: "SELECT count(*)::int AS count FROM users WHERE id LIKE $1",
    rooms: "SELECT count(*)::int AS count FROM rooms WHERE id LIKE $1",
    movies: "SELECT count(*)::int AS count FROM movies WHERE id LIKE $1",
    sessions: "SELECT count(*)::int AS count FROM sessions WHERE id LIKE $1",
    orders: "SELECT count(*)::int AS count FROM orders WHERE id LIKE $1",
    payments: "SELECT count(*)::int AS count FROM payments WHERE id LIKE $1",
    tickets: "SELECT count(*)::int AS count FROM tickets WHERE id LIKE $1",
    subscriptions: "SELECT count(*)::int AS count FROM subscriptions WHERE id LIKE $1"
  };
  const result = { batch: BATCH };
  for (const [name, sql] of Object.entries(checks)) {
    result[name] = (await client.query(sql, [`${PREFIX}%`])).rows[0].count;
  }
  return result;
}

async function main() {
  const action = String(process.argv[2] || "status").toLowerCase();
  if (!["seed", "cleanup", "status"].includes(action)) {
    throw new Error("Uso: node scripts/admin-panel-simulation.js <seed|status|cleanup>");
  }
  if (action !== "status" && process.env.ADMIN_SIMULATION_CONFIRM !== CONFIRMATION) {
    throw new Error(`Defina ADMIN_SIMULATION_CONFIRM=${CONFIRMATION} para executar ${action}.`);
  }
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    if (action === "status") {
      console.log(JSON.stringify(await status(client), null, 2));
      return;
    }
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(318642901, 20260823)");
    const result = action === "seed" ? await seed(client) : await cleanup(client);
    await client.query("COMMIT");
    console.log(JSON.stringify({ action, ...result }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { BATCH, PREFIX, cleanup, seed, status };
