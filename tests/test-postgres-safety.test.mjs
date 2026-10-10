import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseTestUrl, assertDisposableTestDatabase } = require("../scripts/test-postgres-safety.js");

test("destructive PostgreSQL tests reject operational and remote URLs before connecting", () => {
  for (const url of [
    "postgresql://cine_test_admin@localhost/postgres",
    "postgresql://cine_test_admin@localhost/cinecruzeiro",
    "postgresql://cine_test_admin@localhost/cinecruzeiro_test_old",
    "postgresql://app@localhost/cinecruzeiro_test_0123456789abcdef",
    "postgresql://cine_test_admin@localhost/cinecruzeiro_test_0123456789abcdef?host=production.example.com",
    "postgresql://cine_test_admin@production.example.com/cinecruzeiro_test_0123456789abcdef",
    "postgresql://cine_test_admin@10.0.0.1/cinecruzeiro_test_0123456789abcdef"
  ]) assert.throws(() => parseTestUrl(url));
  assert.equal(parseTestUrl("postgresql://cine_test_admin@127.0.0.1/cinecruzeiro_test_0123456789abcdef").hostname, "127.0.0.1");
});

test("destructive PostgreSQL tests require an execution lease", async () => {
  await assert.rejects(
    assertDisposableTestDatabase("postgresql://cine_test_admin@127.0.0.1/cinecruzeiro_test_0123456789abcdef", ""),
    /sem execução autorizada/
  );
});
