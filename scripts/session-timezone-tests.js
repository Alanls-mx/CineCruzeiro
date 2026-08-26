const assert = require("assert/strict");
const { cinemaIsoDate } = require("../backend/db/postgresStore");

assert.equal(
  cinemaIsoDate(new Date("2026-08-27T02:15:00.000Z")),
  "2026-08-26",
  "23:15 em Sao Paulo deve permanecer na data civil do cinema"
);

assert.equal(
  cinemaIsoDate(new Date("2026-08-26T03:50:00.000Z")),
  "2026-08-26",
  "00:50 em Sao Paulo deve permanecer na mesma data civil"
);

assert.equal(cinemaIsoDate(""), "");
assert.equal(cinemaIsoDate("data-invalida"), "");

console.log("Session timezone tests passed.");
