#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(process.env.PG_PACKAGE_JSON || import.meta.url);
const { Client } = require("pg");

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
const targetSlug = process.argv[2];
const sourceUploads = process.env.SOURCE_UPLOADS_DIR;
const targetUploads = process.env.TARGET_UPLOADS_DIR;
if (!sourceUrl || !targetUrl || !sourceUploads || !targetUploads || !targetSlug || targetSlug === "cinecruzeiro") {
  throw new Error("Informe os bancos, diretorios de uploads e o slug do cinema de destino.");
}

const source = new Client({ connectionString: sourceUrl });
const target = new Client({ connectionString: targetUrl });

function copyMovieAsset(url) {
  if (!url) return;
  const pathname = new URL(url, "https://cinema.invalid").pathname;
  if (!pathname.startsWith("/uploads/")) return;
  const relative = decodeURIComponent(pathname.slice("/uploads/".length));
  if (relative.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Caminho de imagem invalido: ${url}`);
  }
  const from = path.join(sourceUploads, relative);
  const to = path.join(targetUploads, relative);
  if (!fs.existsSync(from)) throw new Error(`Imagem ausente: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
}

try {
  await source.connect();
  await target.connect();

  const sessions = (await source.query(`
    SELECT s.*, array_agg(stt.ticket_type_id ORDER BY stt.position)
      FILTER (WHERE stt.ticket_type_id IS NOT NULL) AS ticket_type_ids
    FROM sessions s
    LEFT JOIN session_ticket_types stt ON stt.session_id = s.id
    WHERE s.starts_at >= now() AND s.status <> 'hidden'
    GROUP BY s.id
    ORDER BY s.starts_at, s.id
  `)).rows;

  await target.query("BEGIN");
  await target.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`copy-cruzeiro-sessions:${targetSlug}`]);

  const moviesResult = await target.query("SELECT id FROM movies");
  const roomsResult = await target.query("SELECT id, name FROM rooms WHERE status = 'active' ORDER BY id");
  const ticketTypesResult = await target.query("SELECT id FROM ticket_types WHERE active = true");
  const existingResult = await target.query("SELECT movie_id, room_id, starts_at FROM sessions WHERE starts_at >= now()");
  const movies = new Set(moviesResult.rows.map((row) => row.id));
  const rooms = new Map(roomsResult.rows.map((row) => [row.id, row]));
  const ticketTypes = new Set(ticketTypesResult.rows.map((row) => row.id));
  const fallbackRoom = roomsResult.rows[0];
  if (!fallbackRoom) throw new Error(`O cinema ${targetSlug} nao possui sala ativa.`);

  const occupied = new Set(existingResult.rows.map((row) => `${row.room_id}|${row.starts_at.toISOString()}`));
  const duplicates = new Set(existingResult.rows.map((row) => `${row.movie_id}|${row.starts_at.toISOString()}`));
  const counts = { source: sessions.length, inserted: 0, existing: 0, occupied: 0, copiedMovies: 0, missingMovie: 0 };
  const missingMovies = new Set();

  for (const movieId of new Set(sessions.map((session) => session.movie_id))) {
    if (movies.has(movieId)) continue;
    const movie = (await source.query("SELECT * FROM movies WHERE id = $1", [movieId])).rows[0];
    if (!movie) continue;
    copyMovieAsset(movie.poster_url);
    copyMovieAsset(movie.backdrop_url);
    const columns = Object.keys(movie);
    await target.query(
      `INSERT INTO movies (${columns.map((column) => `"${column}"`).join(", ")})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
       ON CONFLICT (id) DO NOTHING`,
      columns.map((column) => movie[column])
    );
    movies.add(movieId);
    counts.copiedMovies += 1;
  }

  for (const session of sessions) {
    if (!movies.has(session.movie_id)) {
      counts.missingMovie += 1;
      missingMovies.add(session.movie_id);
      continue;
    }

    const startsAt = session.starts_at.toISOString();
    const room = rooms.get(session.room_id) || fallbackRoom;
    const duplicateKey = `${session.movie_id}|${startsAt}`;
    const roomKey = `${room.id}|${startsAt}`;
    if (duplicates.has(duplicateKey)) {
      counts.existing += 1;
      continue;
    }
    if (occupied.has(roomKey)) {
      counts.occupied += 1;
      continue;
    }

    const id = `cruzeiro-copy-${crypto.createHash("sha256").update(`${targetSlug}:${session.id}`).digest("hex").slice(0, 24)}`;
    await target.query(`
      INSERT INTO sessions
        (id, movie_id, room_id, starts_at, time_label, room_label, format,
         price_full, price_half, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
      ON CONFLICT (id) DO NOTHING
    `, [
      id, session.movie_id, room.id, session.starts_at, session.time_label,
      room.name, session.format, session.price_full, session.price_half, session.status,
    ]);
    const matchingTicketTypes = (session.ticket_type_ids || []).filter((typeId) => ticketTypes.has(typeId));
    for (const [index, typeId] of matchingTicketTypes.entries()) {
      await target.query(`
        INSERT INTO session_ticket_types (session_id, ticket_type_id, position, created_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT DO NOTHING
      `, [id, typeId, (index + 1) * 10]);
    }
    occupied.add(roomKey);
    duplicates.add(duplicateKey);
    counts.inserted += 1;
  }

  await target.query("COMMIT");
  console.log(JSON.stringify({ cinema: targetSlug, ...counts, missingMovies: [...missingMovies] }));
} catch (error) {
  await target.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await source.end();
  await target.end();
}
