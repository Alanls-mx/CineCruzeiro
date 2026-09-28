import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildEmailAutomationPlan, emailAutomationContext, _test } = require("../backend/services/emailAutomationService");

const now = new Date("2026-09-28T12:00:00-03:00");
const db = {
  movies: [
    { id: "a", title: "Filme A", status: "active", posterUrl: "/uploads/a.jpg", sessions: [{ date: "2026-09-29", time: "19:00", status: "available" }] },
    { id: "b", title: "Filme B", status: "active", posterUrl: "/uploads/b.jpg", sessions: [{ date: "2026-10-02", time: "21:15", status: "available" }] },
    { id: "hidden", title: "Oculto", status: "hidden", sessions: [{ date: "2026-09-30", time: "18:00" }] }
  ],
  users: [
    { id: "birthday", role: "customer", active: true, birthDate: "1990-09-28" },
    { id: "other", role: "customer", active: true, birthDate: "1991-04-10" }
  ]
};

test("programação semanal usa apenas filmes publicados com sessões no período", () => {
  const plan = buildEmailAutomationPlan(db, { type: "weekly" }, { now, siteUrl: "https://cine.example" });
  assert.equal(plan.skipped, false);
  assert.deepEqual(plan.campaign.movieIds, ["a", "b"]);
  assert.equal(plan.campaign.templateId, "weekly");
  assert.equal(plan.campaign.recipientMode, "all");
  assert.match(plan.campaign.html, /Filme A/);
  assert.match(plan.campaign.html, /29\/09 · 19:00/);
  assert.doesNotMatch(plan.campaign.html, /Oculto/);
  assert.match(plan.campaign.idempotencyKey, /^email-auto:weekly:/);
});

test("planejamento evita repetir a copy mais recente", () => {
  const first = buildEmailAutomationPlan(db, { type: "weekly" }, { now, siteUrl: "https://cine.example" });
  const second = buildEmailAutomationPlan(db, { type: "weekly" }, { now, siteUrl: "https://cine.example", history: [{ subject: first.campaign.subject, headline: first.campaign.headline }] });
  assert.notEqual(second.campaign.subject, first.campaign.subject);
  assert.equal(second.campaign.idempotencyKey, first.campaign.idempotencyKey);
  const third = buildEmailAutomationPlan(db, { type: "weekly" }, { now, siteUrl: "https://cine.example", history: [
    { subject: first.campaign.subject, headline: first.campaign.headline },
    { subject: second.campaign.subject, headline: second.campaign.headline }
  ] });
  assert.doesNotMatch(third.campaign.message, /em cartaz/i);
});

test("aniversário seleciona somente clientes do dia", () => {
  const plan = buildEmailAutomationPlan(db, { type: "birthday" }, { now, siteUrl: "https://cine.example" });
  assert.equal(plan.skipped, false);
  assert.equal(plan.campaign.recipientMode, "birthday_manual");
  assert.deepEqual(plan.campaign.customerIds, ["birthday"]);
});

test("estreia diária exige sinal de lançamento e não duplica o mesmo filme em dias diferentes", () => {
  const premiereDb = { ...db, movies: [{ ...db.movies[0], status: "upcoming", releaseDate: "2026-10-01" }] };
  const first = buildEmailAutomationPlan(premiereDb, { type: "premiere" }, { now, siteUrl: "https://cine.example" });
  const nextDay = buildEmailAutomationPlan(premiereDb, { type: "premiere" }, { now: new Date(now.getTime() + 86400000), siteUrl: "https://cine.example" });
  assert.equal(first.skipped, false);
  assert.equal(first.campaign.movieId, "a");
  assert.equal(first.campaign.idempotencyKey, nextDay.campaign.idempotencyKey);
  const ordinary = buildEmailAutomationPlan(db, { type: "premiere" }, { now, siteUrl: "https://cine.example" });
  assert.equal(ordinary.skipped, true);
});

test("cenário sem conteúdo é ignorado sem criar campanha vazia", () => {
  const plan = buildEmailAutomationPlan({ movies: [], users: [] }, { type: "weekly" }, { now });
  assert.equal(plan.skipped, true);
  assert.match(plan.reason, /Nenhum filme/);
});

test("contexto da automação não expõe dados pessoais", () => {
  const context = emailAutomationContext(db, { now });
  assert.deepEqual(context.supportedTypes.sort(), ["birthday", "premiere", "reactivation", "weekly"]);
  assert.equal(context.weeklyMovies, 2);
  assert.equal(context.birthdayCustomers, 1);
  assert.equal(JSON.stringify(context).includes("birthday"), true);
  assert.equal(JSON.stringify(context).includes("1990-09-28"), false);
  assert.equal(_test.birthdayCustomerIds(db, now).length, 1);
});
