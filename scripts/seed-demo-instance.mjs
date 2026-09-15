#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} e obrigatoria.`);
  return value;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function columnTypes(client, table) {
  const result = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
    [table]
  );
  return new Map(result.rows.map((row) => [row.column_name, row.data_type]));
}

async function insertRows(client, table, rows) {
  if (!rows.length) return;
  const types = await columnTypes(client, table);
  for (const row of rows) {
    const columns = Object.keys(row).filter((column) => types.has(column));
    const values = columns.map((column) => {
      const value = row[column];
      return ["json", "jsonb"].includes(types.get(column)) && value !== null ? JSON.stringify(value) : value;
    });
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
    await client.query(
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")}) VALUES (${placeholders})`,
      values
    );
  }
}

function saoPauloDate(offsetDays) {
  const value = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const find = (type) => parts.find((part) => part.type === type)?.value;
  return `${find("year")}-${find("month")}-${find("day")}`;
}

function localAssetPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let pathname = raw;
  try {
    pathname = new URL(raw, "https://demo.invalid").pathname;
  } catch {
    return "";
  }
  const marker = "/uploads/";
  const index = pathname.indexOf(marker);
  if (index < 0) return "";
  const relative = decodeURIComponent(pathname.slice(index + marker.length)).replaceAll("\\", "/");
  if (!relative || relative.split("/").some((part) => part === ".." || !part)) return "";
  return relative;
}

function copyApprovedAssets(urls, sourceRoot, targetRoot) {
  if (!sourceRoot || !targetRoot) return 0;
  const sourceBase = fs.realpathSync(sourceRoot);
  fs.mkdirSync(targetRoot, { recursive: true });
  let copied = 0;
  for (const relative of new Set(urls.map(localAssetPath).filter(Boolean))) {
    const source = path.resolve(sourceBase, relative);
    const destination = path.resolve(targetRoot, relative);
    if (!source.startsWith(`${sourceBase}${path.sep}`) || !destination.startsWith(`${path.resolve(targetRoot)}${path.sep}`)) continue;
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    copied += 1;
  }
  return copied;
}

function cleanMovie(row, index) {
  return {
    ...row,
    status: index < 6 ? "now_playing" : "upcoming",
    workflow_status: "published",
    is_highlight: index === 0,
    local_trailer_url: "",
    trailer_source_url: "",
    trailer_cache_status: "idle",
    trailer_cache_error: "",
    published_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function sanitizeBrandReferences(value, cinemaName) {
  if (typeof value === "string") return value.replace(/Cine\s+Cruzeiro/gi, cinemaName);
  if (Array.isArray(value)) return value.map((item) => sanitizeBrandReferences(item, cinemaName));
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeBrandReferences(item, cinemaName)])
  );
}

async function main() {
  const sourceUrl = required("SOURCE_DATABASE_URL");
  const targetUrl = required("DATABASE_URL");
  if (sourceUrl === targetUrl) throw new Error("O banco de origem nao pode ser o banco demonstrativo.");
  const cinemaName = required("DEMO_CINEMA_NAME");
  const cinemaCity = required("DEMO_CINEMA_CITY");
  const instagram = String(process.env.DEMO_INSTAGRAM || "").trim();
  const adminName = required("DEMO_ADMIN_NAME");
  const adminEmail = required("DEMO_ADMIN_EMAIL").toLowerCase();
  const adminPassword = required("DEMO_ADMIN_PASSWORD");
  const slug = required("DEMO_SLUG");

  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({ connectionString: targetUrl });
  await source.connect();
  await target.connect();
  try {
    const populated = await target.query("SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM orders) AS orders");
    if (Number(populated.rows[0].users) || Number(populated.rows[0].orders)) {
      throw new Error("O banco demonstrativo nao esta vazio; carga recusada.");
    }

    const sourceSettings = await source.query("SELECT value FROM settings WHERE key='app'");
    const roomsResult = await source.query("SELECT * FROM rooms WHERE status <> 'hidden' ORDER BY name");
    const ticketTypesResult = await source.query("SELECT * FROM ticket_types WHERE active=true ORDER BY name");
    const moviesResult = await source.query("SELECT * FROM movies WHERE workflow_status='published' AND status <> 'hidden' ORDER BY sort_order, title");
    const concessionsResult = await source.query("SELECT * FROM concessions WHERE active=true ORDER BY sort_order, name");
    const inventoryResult = await source.query("SELECT * FROM concession_inventory");
    const plansResult = await source.query("SELECT * FROM subscription_plans WHERE active=true ORDER BY display_order, monthly_price").catch(() => ({ rows: [] }));
    if (!roomsResult.rows.length || !moviesResult.rows.length || !ticketTypesResult.rows.length) {
      throw new Error("Catalogo-base insuficiente para a demonstracao.");
    }

    const sourceApp = sourceSettings.rows[0]?.value || {};
    const settings = {
      cinemaName,
      cinemaCity,
      instagram,
      currency: "BRL",
      defaultTicketPrice: Number(sourceApp.defaultTicketPrice || ticketTypesResult.rows[0]?.price || 10),
      integrations: {},
      mercadoPagoSubscriptionPlans: {},
      marketingAdsEnabled: false,
      demoInstallation: true,
    };
    const rooms = roomsResult.rows.map((sourceRow, index) => ({
      ...sanitizeBrandReferences(sourceRow, cinemaName),
      name: index === 0 ? "Sala Principal" : `Sala ${index + 1}`,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    const ticketTypes = ticketTypesResult.rows.map((row) => ({
      ...sanitizeBrandReferences(row, cinemaName),
      created_at: new Date(),
      updated_at: new Date(),
    }));
    const movies = moviesResult.rows.map((row, index) => cleanMovie(sanitizeBrandReferences(row, cinemaName), index));
    const concessions = concessionsResult.rows.map((row) => ({
      ...sanitizeBrandReferences(row, cinemaName),
      image_url: "",
      created_at: new Date(),
      updated_at: new Date(),
    }));
    const inventoryById = new Map(inventoryResult.rows.map((row) => [row.concession_id, row]));
    const inventory = concessions.map((item) => {
      const sourceItem = inventoryById.get(item.id) || {};
      return {
        concession_id: item.id,
        available: item.stock_unit === "unit" ? 100 : item.stock_unit === "kg" ? 50 : item.stock_unit === "g" ? 50000 : 50000000,
        reserved: 0,
        sold: 0,
        consumed_mass: 0,
        updated_at: new Date(),
        ...("stock_unit" in sourceItem ? { stock_unit: sourceItem.stock_unit } : {}),
      };
    });
    const plans = plansResult.rows.map((row) => ({
      ...sanitizeBrandReferences(row, cinemaName),
      provider_plan_id: "",
      mercado_pago_plan_id: "",
      image_url: "",
      eligible_session_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await target.query("BEGIN");
    await insertRows(target, "settings", [{ key: "app", value: settings, updated_at: new Date() }]);
    await insertRows(target, "rooms", rooms);
    await insertRows(target, "ticket_types", ticketTypes);
    await insertRows(target, "movies", movies);
    await insertRows(target, "concessions", concessions);
    await insertRows(target, "concession_inventory", inventory);
    await insertRows(target, "subscription_plans", plans);
    await insertRows(target, "users", [{
      id: crypto.randomUUID(),
      name: adminName,
      email: adminEmail,
      password_hash: hashPassword(adminPassword),
      auth_provider: "email",
      email_verified: true,
      role: "owner",
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);

    const activeMovies = movies.slice(0, Math.min(6, movies.length));
    const room = rooms[0];
    const activeTicketTypes = ticketTypes.slice(0, Math.min(3, ticketTypes.length));
    const sessionRows = [];
    const sessionTicketRows = [];
    const slots = ["14:00", "17:00", "20:00"];
    for (let day = 0; day < 14; day += 1) {
      const date = saoPauloDate(day);
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const movie = activeMovies[(day * slots.length + slotIndex) % activeMovies.length];
        const time = slots[slotIndex];
        const id = `demo-${slug}-${date.replaceAll("-", "")}-${time.replace(":", "")}`;
        sessionRows.push({
          id,
          movie_id: movie.id,
          room_id: room.id,
          starts_at: new Date(`${date}T${time}:00-03:00`),
          time_label: time,
          room_label: room.name,
          format: "2D Dublado",
          price_full: Number(activeTicketTypes[0]?.price || 10),
          price_half: Number(activeTicketTypes[1]?.price || activeTicketTypes[0]?.price || 5),
          status: "available",
          created_at: new Date(),
          updated_at: new Date(),
        });
        activeTicketTypes.forEach((ticketType, position) => sessionTicketRows.push({
          session_id: id,
          ticket_type_id: ticketType.id,
          position: (position + 1) * 10,
          created_at: new Date(),
        }));
      }
    }
    await insertRows(target, "sessions", sessionRows);
    await insertRows(target, "session_ticket_types", sessionTicketRows);
    await target.query("COMMIT");

    const assetUrls = movies.flatMap((movie) => [movie.poster_url, movie.backdrop_url]);
    const copiedAssets = copyApprovedAssets(
      assetUrls,
      String(process.env.SOURCE_UPLOADS_DIR || ""),
      String(process.env.TARGET_UPLOADS_DIR || "")
    );
    console.log(`DEMO_SEED_OK=${slug};MOVIES=${movies.length};SESSIONS=${sessionRows.length};ASSETS=${copiedAssets}`);
  } catch (error) {
    await target.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(`DEMO_SEED_ERROR: ${error.message}`);
  process.exit(1);
});
