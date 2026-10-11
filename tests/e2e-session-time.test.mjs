import test from "node:test";
import assert from "node:assert/strict";
import sessionTime from "../scripts/e2e-session-time.js";

test("sessão E2E de amanhã fica futura e dentro da janela de venda de 24 horas", () => {
  for (const instant of [
    "2026-10-11T02:59:59.000Z",
    "2026-10-11T03:00:00.000Z",
    "2026-10-11T03:00:01.000Z",
    "2026-10-11T16:35:00.000Z"
  ]) {
    const now = new Date(instant);
    const session = sessionTime.sellableTomorrowSession(now);
    const startsAt = new Date(`${session.date}T${session.time}:00-03:00`);
    assert.ok(startsAt.getTime() > now.getTime(), instant);
    assert.ok(startsAt.getTime() - now.getTime() <= 86400000, instant);
  }
});
