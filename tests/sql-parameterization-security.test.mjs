import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const storePath = require.resolve("../backend/db/postgresStore.js");
const originalStore = require.cache[storePath];
const calls = [];
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    postgresEnabled: () => true,
    queryPostgres: async (sql, values = []) => {
      calls.push({ sql, values });
      return { rows: sql.includes("COUNT(*)::integer AS total") ? [{ total: 0 }] : [] };
    },
    withPostgresTransaction: async (callback) => callback({ query: async () => ({ rows: [] }) })
  }
};
const campaigns = require("../backend/services/emailCampaignRepository.js");
const { SocialStudioAutomationRepository } = require("../backend/repositories/socialStudioAutomationRepository.js");
if (originalStore) require.cache[storePath] = originalStore;
else delete require.cache[storePath];

test("filtros de campanhas nao entram na estrutura SQL", async () => {
  calls.length = 0;
  const attack = "x%' OR 1=1; DROP TABLE email_campaigns; --";
  await campaigns.listCampaigns({ search: attack, statuses: [attack], order: "asc; DROP TABLE users", item: attack });
  assert.equal(calls.length, 3);
  for (const call of calls) assert.doesNotMatch(call.sql, /DROP TABLE|OR 1=1/);
  assert.match(calls[1].sql, /ORDER BY created_at DESC LIMIT \$\d+ OFFSET \$\d+/);
  assert.ok(calls[1].values.includes(attack));
  assert.ok(calls[1].values.includes(`%${attack}%`));
});

test("atualizacao do Studio so usa colunas da lista interna", async () => {
  calls.length = 0;
  const attack = "status='paid'; DROP TABLE users; --";
  const repository = new SocialStudioAutomationRepository();
  await repository.update(attack, { status: attack, "status = NULL; DROP TABLE users": attack });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SET status=\$1,updated_at=\$2 WHERE id=\$3/);
  assert.doesNotMatch(calls[0].sql, /DROP TABLE/);
  assert.equal(calls[0].values[0], attack);
  assert.match(calls[0].values[1], /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(calls[0].values[2], attack);
});
