import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createSnapshotCache} = require('../backend/db/snapshotCache');
const {poolConfiguration} = require('../backend/db/databasePolicy');

test('concurrent reads share queries but receive isolated copies', async () => {
  let loads = 0;
  const cache = createSnapshotCache({load: async () => { loads++; return {items: []}; }, clone: structuredClone});
  const [a, b] = await Promise.all([cache.read('operational'), cache.read('operational')]);
  a.items.push('changed');
  assert.deepEqual(b, {items: []});
  assert.deepEqual(await cache.read('operational'), {items: []});
  assert.equal(loads, 1);
  await cache.read('full');
  assert.equal(loads, 2);
});

test('invalidation prevents an older pending query from repopulating cache', async () => {
  const resolvers = [];
  const cache = createSnapshotCache({load: () => new Promise(resolve => resolvers.push(resolve)), clone: structuredClone});
  const old = cache.read('operational');
  await Promise.resolve();
  cache.invalidate();
  const fresh = cache.read('operational');
  await Promise.resolve();
  resolvers[1]({version: 2});
  assert.deepEqual(await fresh, {version: 2});
  resolvers[0]({version: 1});
  await old;
  assert.deepEqual(await cache.read('operational'), {version: 2});
});

test('cache expires and failed queries do not poison subsequent reads', async () => {
  let clock = 0, loads = 0;
  const cache = createSnapshotCache({ttlMs: 10, now: () => clock, clone: structuredClone, load: async () => {
    loads++;
    if (loads === 1) throw new Error('connection lost');
    return {version: loads};
  }});
  await assert.rejects(cache.read('operational'));
  assert.equal((await cache.read('operational')).version, 2);
  clock = 11;
  assert.equal((await cache.read('operational')).version, 3);
});

test('pool configuration remains bounded with invalid input', () => {
  const config = poolConfiguration({POSTGRES_POOL_MAX: '999', POSTGRES_STATEMENT_TIMEOUT_MS: 'NaN', POSTGRES_CONNECT_TIMEOUT_MS: '0'});
  assert.equal(config.max, 30);
  assert.equal(config.statement_timeout, 15000);
  assert.equal(config.connectionTimeoutMillis, 500);
  assert.equal(poolConfiguration({}).max, 6);
});
