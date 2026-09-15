import assert from "node:assert/strict";
import test from "node:test";
import calendarDateService from "../backend/services/calendarDateService.js";
import movieRepository from "../backend/repositories/movieRepository.js";

const { calendarDateKey } = calendarDateService;

test("preserva datas de calendário vindas como texto ou Date do PostgreSQL", () => {
  assert.equal(calendarDateKey("2026-09-18"), "2026-09-18");
  assert.equal(calendarDateKey("2026-09-18T00:00:00.000Z"), "2026-09-18");
  assert.equal(calendarDateKey(new Date("2026-09-18T00:00:00.000Z")), "2026-09-18");
});

test("o repositório devolve a data de estreia em formato compatível com input date", () => {
  const movie = movieRepository.mapMovie({
    id: "filme",
    title: "Filme",
    status: "upcoming",
    release_date: new Date("2026-09-18T00:00:00.000Z")
  });
  assert.equal(movie.releaseDate, "2026-09-18");
});
