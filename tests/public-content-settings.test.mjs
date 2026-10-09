import test from "node:test";
import assert from "node:assert/strict";
import service from "../backend/services/publicContentSettings.js";

test("configuracoes publicas usam allowlist e nao herdam novos segredos", () => {
  const result = service.publicContentSettings({
    cinemaName: "Cine Cruzeiro",
    announcementEnabled: true,
    logoUrl: "/images/logo.webp",
    integrations: { mercadoPago: { accessToken: "secret" } },
    webhookSimulatorRuns: [{ id: "private" }],
    futureSecret: "never-public"
  });
  assert.deepEqual(result, {
    cinemaName: "Cine Cruzeiro",
    announcementEnabled: true,
    logoUrl: "/images/logo.webp"
  });
});
