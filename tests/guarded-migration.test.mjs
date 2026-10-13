import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { assertPilotAuthorization, assertAuthorizationShape, runGuardedMigration } = require("../scripts/guarded-migration.js");
const release = "ea7c5df24cf44d64516d00d81585cb2b0f7efe09";
const candidate = "a".repeat(40);

test("pilot target is pinned independently of the supplied authorization", () => {
  const baseline = { instance: "cinecruzeiro", database: "cinecruzeiro_test_wrong",
    role: "cinecruzeiro_test_wrong", expectedRelease: release, candidateSha: candidate,
    pending: ["051_ticket_email_jobs.sql", "052_point_payment_methods.sql"] };
  assert.throws(() => assertPilotAuthorization(baseline), /MIGRATION_TARGET_REJECTED/);
  assert.throws(() => assertPilotAuthorization({ ...baseline, instance: "other" }, "0".repeat(12)), /MIGRATION_TARGET_REJECTED/);
});

test("runner requires the pinned pilot by default before touching a connection", async () => {
  let touched = false;
  await assert.rejects(runGuardedMigration({
    client: { query: async () => { touched = true; } },
    connectionString: "postgresql://other@127.0.0.1/other",
    authorization: { instance: "other" }, migrationsDir: ".", releaseSha: candidate
  }), /MIGRATION_TARGET_REJECTED/);
  assert.equal(touched, false);
});

test("connection URL and candidate cannot be retargeted", () => {
  const authorization = { instance: "cinecruzeiro", database: "pilot", role: "pilot",
    candidateSha: candidate, origin: { host: "127.0.0.1", port: 5432,
      serverAddress: "127.0.0.1", serverPort: 5432 },
    applied: ["050_room_cleanup_minutes.sql"], pending: ["051_ticket_email_jobs.sql"], hashes: {} };
  const url = "postgresql://pilot:secret@127.0.0.1:5432/pilot";
  assert.equal(assertAuthorizationShape(authorization, url, candidate).hostname, "127.0.0.1");
  for (const invalid of [
    [authorization, url.replace("/pilot", "/other"), candidate],
    [authorization, url.replace("pilot:secret", "other:secret"), candidate],
    [authorization, url.replace("127.0.0.1", "localhost"), candidate],
    [authorization, `${url}?options=-csearch_path%3Dother`, candidate],
    [authorization, url, "b".repeat(40)],
    [{ ...authorization, pending: [] }, url, candidate]
  ]) assert.throws(() => assertAuthorizationShape(...invalid), /MIGRATION_TARGET_REJECTED/);
});
