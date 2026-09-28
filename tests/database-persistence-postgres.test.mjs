import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const require = createRequire(import.meta.url);
const store = require("../backend/db/postgresStore");
const users = require("../backend/repositories/userRepository");
const { runMutation } = require("../backend/repositories/repositorySupport");
const enabled = Boolean(process.env.TEST_DATABASE_URL);

test("persistência incremental preserva reservas, consentimento, auditoria e alterações concorrentes", { skip: !enabled }, async () => {
  const suffix = `polish-${Date.now()}`;
  const q = store.queryPostgres;
  const read = () => store.readDbFromPostgres({ includeAuditLogs: false });
  const setting = `testPolish${Date.now()}`;
  try {
    await q("INSERT INTO users (id,name,email) VALUES ($1,'Cliente',$2)", [suffix, `${suffix}@example.test`]);
    await q("INSERT INTO rooms (id,name,capacity) VALUES ($1,'Sala Teste',10)", [suffix]);
    await q("INSERT INTO movies (id,title) VALUES ($1,'Filme Teste')", [suffix]);
    await q("INSERT INTO sessions (id,movie_id,room_id,time_label,format,price_full,price_half) VALUES ($1,$1,$1,'19:00','2D',12,6)", [suffix]);
    await q("INSERT INTO seat_holds (session_id,seat_id,owner_token,expires_at) VALUES ($1,'A1','test',now()+interval '10 minutes')", [suffix]);
    await q("INSERT INTO email_marketing_preferences (user_id,marketing_email_enabled) VALUES ($1,false)", [suffix]);
    await q("INSERT INTO email_unsubscribe_tokens (token_hash,user_id) VALUES ($1,$1)", [suffix]);
    await q("INSERT INTO orders (id,customer_user_id,customer_name,status,total) VALUES ($1,$1,'Cliente','pending_payment',12)", [suffix]);
    const orderItem = await q("INSERT INTO order_items (order_id,item_type,item_id,name,quantity,unit_price,total_price) VALUES ($1,'ticket','test','Ingresso',1,12,12) RETURNING id", [suffix]);
    const audit = await q("INSERT INTO audit_logs (user_id,action,entity_type) VALUES ($1,'polish.test','user') RETURNING id", [suffix]);
    store.invalidatePostgresSnapshot();
    const initialVersion = (await q("SELECT xmin::text AS version FROM users WHERE id=$1", [suffix])).rows[0].version;
    const db = await read();
    db.settings[setting] = { value: 1 };
    db.movies.find((movie) => movie.id === suffix).title = "Filme atualizado";
    await store.writeDbToPostgres(db);
    assert.equal((await q("SELECT xmin::text AS version FROM users WHERE id=$1", [suffix])).rows[0].version, initialVersion);
    assert.equal((await q("SELECT count(*)::int AS n FROM seat_holds WHERE session_id=$1", [suffix])).rows[0].n, 1);
    assert.equal((await q("SELECT marketing_email_enabled FROM email_marketing_preferences WHERE user_id=$1", [suffix])).rows[0].marketing_email_enabled, false);
    assert.equal((await q("SELECT count(*)::int AS n FROM email_unsubscribe_tokens WHERE user_id=$1", [suffix])).rows[0].n, 1);
    assert.equal((await q("SELECT count(*)::int AS n FROM audit_logs WHERE id=$1", [audit.rows[0].id])).rows[0].n, 1);
    assert.equal((await q("SELECT id FROM order_items WHERE order_id=$1", [suffix])).rows[0].id, orderItem.rows[0].id);

    const withOrder = await read();
    withOrder.orders.find(order => order.id === suffix).customerName = 'Nome corrigido';
    await store.writeDbToPostgres(withOrder);
    assert.equal((await q("SELECT id FROM order_items WHERE order_id=$1", [suffix])).rows[0].id, orderItem.rows[0].id);
    const withItems = await read();
    withItems.orders.find(order => order.id === suffix).ticketItems[0].quantity = 2;
    await store.writeDbToPostgres(withItems);
    assert.equal((await q("SELECT quantity FROM order_items WHERE order_id=$1", [suffix])).rows[0].quantity, 2);
    assert.equal((await q("SELECT count(*)::int AS n FROM order_items WHERE order_id=$1", [suffix])).rows[0].n, 1);

    await assert.rejects(runMutation({event: 'test.rollback', audit: {userId: suffix, action: 'invalid\u0000text'}}, async client => {
      await client.query("UPDATE users SET name='Must rollback' WHERE id=$1", [suffix]);
    }));
    assert.equal((await users.findById(suffix)).name, 'Cliente');
    await assert.rejects(store.withPostgresTransaction(() => store.writeDbToPostgres(db)), /transação compartilhada/);

    const stale = await read();
    await users.updateFields(suffix, { name: "Atualização concorrente" });
    stale.settings[setting] = { value: 2 };
    await store.writeDbToPostgres(stale);
    assert.equal((await users.findById(suffix)).name, "Atualização concorrente");
    stale.users.find((user) => user.id === suffix).name = "Conflito";
    await assert.rejects(store.writeDbToPostgres(stale), { code: "DATABASE_CONCURRENT_CHANGE" });
    assert.equal((await users.findById(suffix)).name, "Atualização concorrente");

    const latest = await read();
    latest.auditLogs.push({ action: "polish.append", entityType: "user", userId: suffix });
    await store.writeDbToPostgres(latest);
    await store.writeDbToPostgres(latest);
    assert.equal((await q("SELECT count(*)::int AS n FROM audit_logs WHERE user_id=$1 AND action='polish.append'", [suffix])).rows[0].n, 1);
    latest.movies.find((movie) => movie.id === suffix).sessions = [];
    await store.writeDbToPostgres(latest);
    assert.equal((await q("SELECT count(*)::int AS n FROM sessions WHERE id=$1", [suffix])).rows[0].n, 0);
    assert.equal((await q("SELECT count(*)::int AS n FROM movies WHERE id=$1", [suffix])).rows[0].n, 1);
  } finally {
    await q("DELETE FROM audit_logs WHERE user_id=$1", [suffix]);
    await q("DELETE FROM orders WHERE id=$1", [suffix]);
    await q("DELETE FROM movies WHERE id=$1", [suffix]);
    await q("DELETE FROM rooms WHERE id=$1", [suffix]);
    await q("DELETE FROM users WHERE id=$1", [suffix]);
    await q("UPDATE settings SET value=value-$1 WHERE key='app'", [setting]);
    store.invalidatePostgresSnapshot();
  }
});

test('committed changes from another connection invalidate the snapshot cache', {skip: !enabled}, async () => {
  const {Client} = require('pg');
  const client = new Client({connectionString: process.env.TEST_DATABASE_URL});
  const setting = `testNotification${Date.now()}`;
  const waitFor = async predicate => {
    for (let i = 0; i < 100; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail('Database notification did not arrive');
  };
  try {
    store.enablePostgresCacheInvalidation();
    await waitFor(() => store.postgresDiagnostics().cache.notificationsConnected);
    await client.connect();
    await store.readDbFromPostgres({includeAuditLogs: false});
    const before = store.postgresDiagnostics().cache.invalidations;
    await client.query("INSERT INTO settings(key,value) VALUES ('app',jsonb_build_object($1::text,42)) ON CONFLICT(key) DO UPDATE SET value=settings.value||EXCLUDED.value", [setting]);
    await waitFor(() => store.postgresDiagnostics().cache.invalidations > before);
    assert.equal((await store.readDbFromPostgres({includeAuditLogs: false})).settings[setting], 42);
  } finally {
    await client.query("UPDATE settings SET value=value-$1 WHERE key='app'", [setting]);
    await client.end();
    await store.closePostgres();
  }
});
