import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../backend/db/postgresStore.js',import.meta.url),'utf8');

test('snapshot relacional reutiliza leituras e continua invalidado por mutações',()=>{
  assert.match(source,/POSTGRES_SNAPSHOT_CACHE_TTL_MS \|\| 30000/);
  assert.match(source,/Math\.min\(60000, Math\.max\(2000, configuredSnapshotCacheTtlMs\)\)/);
  assert.match(source,/async function readDbFromPostgres[\s\S]*snapshotCache && Date\.now\(\) < snapshotCacheExpiresAt/);
  assert.match(source,/async function withPostgresMutationLock[\s\S]*invalidateSnapshotCache\(\)/);
  assert.match(source,/async function writeDbToPostgres[\s\S]*COMMIT[\s\S]*invalidateSnapshotCache\(\)/);
  assert.match(source,/async function appendAuditLogToPostgres[\s\S]*invalidateSnapshotCache\(\)/);
});
