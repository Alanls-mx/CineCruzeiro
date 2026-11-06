import { test } from "node:test";
import assert from "node:assert/strict";
import serviceFactory from "../backend/services/googleWalletIntegrationService.js";

function fixture({ cinemaName = "Cinema Teste" } = {}) {
  const requests = [];
  const identity = {
    eventName: { defaultValue: { value: "Ingresso Cinema Teste" } },
    issuerName: "Cinema Teste",
    logo: { sourceUri: { uri: "https://cinema.invalid/logo.webp" } }
  };
  const wallet = {
    issuerId: "issuer", classId: "issuer.ingressos", configuredClassId: "issuer.ingressos",
    clientEmail: "service@cinema.invalid", privateKey: "synthetic", origins: ["https://cinema.invalid"],
    environment: "production"
  };
  const service = serviceFactory.createGoogleWalletIntegrationService({
    getGoogleWalletConfig: () => wallet,
    appFrontendUrl: () => "https://cinema.invalid",
    buildGoogleWalletClassIdentityForCinema: () => identity,
    buildGoogleWalletClassTemplateInfo: () => ({}),
    signWalletJwt: () => "synthetic-assertion",
    logEvent: () => {},
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method || "GET" });
      if (url.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "synthetic-token" }) };
      if (url.includes("/eventTicketClass/")) return {
        ok: true,
        json: async () => ({ id: "issuer.ingressos", reviewStatus: "APPROVED", ...identity, classTemplateInfo: {} })
      };
      throw new Error(`Unexpected request: ${url}`);
    }
  });
  return { service, requests, db: { settings: { cinemaName } } };
}

test("Wallet import and incomplete local identity cause no external request", async () => {
  const { service, requests, db } = fixture({ cinemaName: "" });
  assert.equal(requests.length, 0);
  const result = await service.testGoogleWalletIntegration(db);
  assert.equal(result.ok, false);
  assert.equal(result.checks[0].key, "cinemaBrand");
  assert.equal(requests.length, 0);
});

test("valid Wallet diagnosis checks the configured class without creating another issuer", async () => {
  const { service, requests, db } = fixture();
  const result = await service.testGoogleWalletIntegration(db);
  assert.equal(result.ok, true);
  assert.deepEqual(requests.map((item) => item.method), ["POST", "GET"]);
  assert.match(requests[1].url, /\/eventTicketClass\/issuer\.ingressos$/);
  assert.equal(result.resolvedClassId, "issuer.ingressos");
});
