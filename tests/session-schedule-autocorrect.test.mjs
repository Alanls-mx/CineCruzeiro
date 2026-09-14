import test from "node:test";
import assert from "node:assert/strict";
import service from "../backend/services/sessionScheduleAutocorrectService.js";

const movies = [
  { id: "a", title: "Filme A", duration: "2h", sessions: [{ id: "a1", date: "2026-09-20", time: "19:00", room: "Sala 1", status: "available" }] },
  { id: "b", title: "Filme B", duration: "1h 30min", sessions: [{ id: "b1", date: "2026-09-20", time: "19:30", room: "Sala 1", status: "available" }] }
];

test("sugere o primeiro horário livre considerando duração e limpeza", () => {
  const plan = service.buildSessionAutocorrectPlan({ movies, now: new Date("2026-09-19T12:00:00-03:00").getTime(), turnaroundMinutes: 20 });
  assert.equal(plan.changes.length, 1);
  assert.deepEqual(plan.changes[0].to, { date: "2026-09-20", time: "21:20" });
});

test("mantém sessão com vendas e informa conflito não resolvido", () => {
  const plan = service.buildSessionAutocorrectPlan({ movies, tickets: [{ sessionId: "a1" }, { sessionId: "b1" }], now: new Date("2026-09-19T12:00:00-03:00").getTime() });
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.unresolved.length, 1);
  assert.equal(plan.unresolved[0].reason, "Sessão com vendas vinculadas");
});

test("pode incluir sessões com vendas quando autorizado na prévia", () => {
  const plan = service.buildSessionAutocorrectPlan({ movies, tickets: [{ sessionId: "b1" }], includeSales: true, now: new Date("2026-09-19T12:00:00-03:00").getTime() });
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].hasSales, true);
});

test("não cria conflito com sessão fora do período filtrado", () => {
  const calendar = [
    { id: "a", title: "Filme A", duration: "2h", sessions: [{ id: "a1", date: "2026-09-20", time: "22:00", room: "Sala 1", status: "available" }] },
    { id: "b", title: "Filme B", duration: "2h", sessions: [{ id: "b1", date: "2026-09-20", time: "22:30", room: "Sala 1", status: "available" }] },
    { id: "c", title: "Filme C", duration: "1h", sessions: [{ id: "c1", date: "2026-09-21", time: "00:30", room: "Sala 1", status: "available" }] }
  ];
  const plan = service.buildSessionAutocorrectPlan({ movies: calendar, filters: { from: "2026-09-20", to: "2026-09-20" }, now: new Date("2026-09-19T12:00:00-03:00").getTime(), turnaroundMinutes: 20 });
  assert.deepEqual(plan.changes[0].to, { date: "2026-09-21", time: "01:50" });
});
