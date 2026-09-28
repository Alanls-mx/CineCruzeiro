import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {Client} = require('pg');
const {poolConfiguration} = require('../backend/db/databasePolicy');

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) throw new Error('Configure DATABASE_URL ou POSTGRES_URL.');
const config = poolConfiguration();
const client = new Client({...config, application_name: 'cine-database-diagnostics'});
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const capacity = (await client.query(`SELECT current_setting('max_connections')::int AS maximum,
    count(*)::int AS connections,
    count(*) FILTER (WHERE state='active')::int AS active,
    count(*) FILTER (WHERE state='idle in transaction')::int AS idle_transactions,
    count(*) FILTER (WHERE wait_event_type='Lock')::int AS waiting_locks,
    coalesce(max(extract(epoch FROM now()-xact_start)) FILTER (WHERE state='idle in transaction'),0)::float AS oldest_idle_seconds
    FROM pg_stat_activity`)).rows[0];
  const tables = (await client.query(`SELECT relname AS table_name, n_live_tup, n_dead_tup,
    pg_total_relation_size(relid)::bigint AS bytes, seq_scan, idx_scan,
    last_autovacuum, last_autoanalyze
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15`)).rows;
  const size = (await client.query('SELECT pg_database_size(current_database())::bigint AS bytes')).rows[0];
  await client.query('COMMIT');
  const budget = Math.floor(capacity.maximum * 0.7);
  const warnings = [];
  if (capacity.connections >= budget) warnings.push('Conexoes acima do orcamento de 70%; revise pools e workers antes de adicionar instancias.');
  if (capacity.oldest_idle_seconds > 30) warnings.push('Transacao ociosa acima de 30s; investigar chamada externa dentro de transacao.');
  if (capacity.waiting_locks) warnings.push('Ha conexoes esperando locks; correlacione com p95 e duracao das transacoes.');
  console.log(JSON.stringify({
    capturedAt: new Date().toISOString(), databaseBytes: size.bytes, capacity,
    scaling: {connectionBudget: budget, perBackendPool: config.max, listenerConnectionsPerBackend: 1,
      theoreticalBackendLimit: Math.floor(budget / (config.max + 1)),
      note: 'Subtraia conexoes de n8n, workers e outros servicos antes de usar este limite.'},
    timeouts: {connectMs: config.connectionTimeoutMillis, statementMs: config.statement_timeout,
      lockMs: config.lock_timeout, idleTransactionMs: config.idle_in_transaction_session_timeout},
    warnings, tables
  }, null, 2));
} finally {
  await client.end();
}
