import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { captureSnapshot, changesBetween, assertCurrent, createSnapshotWriter, deleteRemovedRows } = require("../backend/db/snapshotChanges");

const fixture = () => ({ settings: { title: "Cinema" }, users: [{ id: "u", name: "A" }], movies: [{ id: "m", title: "Filme", sessions: [{ id: "s", time: "19:00", ticketTypeIds: ["t"] }] }] });

test("alteração de configuração não regrava entidades nem suas relações", async () => {
  const before = fixture(), after = structuredClone(before);
  after.settings.title = "Novo cinema";
  const changes = changesBetween(captureSnapshot(before), captureSnapshot(after));
  assert.deepEqual(changes.settingsChanged, ["title"]);
  assert.ok([...changes.tables.values()].every((entry) => !entry.changed.size && !entry.removed.size));
  const queries = [];
  const client = { query: async (...args) => queries.push(args) };
  await createSnapshotWriter(client, changes)(client, "INSERT INTO users (id, name) VALUES ($1,$2)", ["u", "A"]);
  await deleteRemovedRows(client, changes);
  assert.equal(queries.length, 0);
});

test("mudança de sessão é independente do filme e remoção fica restrita ao ID", async () => {
  const before = fixture(), after = structuredClone(before);
  after.movies[0].sessions = [];
  const changes = changesBetween(captureSnapshot(before), captureSnapshot(after));
  assert.equal(changes.tables.get("movies").changed.size, 0);
  assert.deepEqual([...changes.tables.get("sessions").removed], ["s"]);
  const queries = [];
  await deleteRemovedRows({ query: async (...args) => queries.push(args) }, changes);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(([sql]) => sql.includes("WHERE")));
});

test("mescla entidades independentes e rejeita concorrência no mesmo registro", () => {
  const original = fixture(), intended = structuredClone(original), current = structuredClone(original);
  intended.settings.title = "Novo";
  current.users[0].name = "Outro operador";
  const before = captureSnapshot(original);
  assert.doesNotThrow(() => assertCurrent(before, captureSnapshot(current), changesBetween(before, captureSnapshot(intended))));
  intended.users[0].name = "Sobrescrever";
  assert.throws(() => assertCurrent(before, captureSnapshot(current), changesBetween(before, captureSnapshot(intended))), { code: "DATABASE_CONCURRENT_CHANGE", statusCode: 409 });
});

test("atualização preserva created_at e só executa UPDATE quando há diferença", async () => {
  const before = fixture(), after = structuredClone(before);
  after.users[0].name = "Novo";
  const queries = [];
  const client = { query: async (...args) => queries.push(args) };
  const write = createSnapshotWriter(client, changesBetween(captureSnapshot(before), captureSnapshot(after)));
  await write(client, "INSERT INTO users (id, name, created_at, updated_at) VALUES ($1,$2,now(),now())", ["u", "Novo"]);
  assert.match(queries[0][0], /ON CONFLICT \(id\) DO UPDATE SET/);
  assert.doesNotMatch(queries[0][0], /created_at=EXCLUDED/);
  assert.match(queries[0][0], /IS DISTINCT FROM/);
  assert.deepEqual(queries[0][1], ["u", "Novo"]);
});
