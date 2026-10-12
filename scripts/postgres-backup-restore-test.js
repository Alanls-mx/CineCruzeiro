const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { parseAdminUrl, assertDisposableTestServer, assertDisposableTestDatabase } = require("./test-postgres-safety");

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: null, maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${program} failed: ${result.error?.message || result.stderr?.toString("utf8") || result.status}`);
  }
  return result.stdout;
}

function tool(name, args, input) {
  const container = process.env.POSTGRES_SERVICE_CONTAINER_ID;
  const internalPort = process.env.GITHUB_ACTIONS === "true" && /^[a-f0-9]{64}$/.test(container || "")
    ? "5432" : String(parseAdminUrl(process.env.TEST_POSTGRES_ADMIN_URL).port || 5432);
  const commandArgs = ["-p", internalPort, ...args];
  if (process.env.GITHUB_ACTIONS === "true" && /^[a-f0-9]{64}$/.test(container || "")) {
    return run("docker", ["exec", ...(input ? ["-i"] : []), "-e", "PGPASSWORD", container,
      name, ...commandArgs], { input, env: { ...process.env, PGPASSWORD: parseAdminUrl(process.env.TEST_POSTGRES_ADMIN_URL).password } });
  }
  return run(name, commandArgs, { input, env: { ...process.env, PGPASSWORD: parseAdminUrl(process.env.TEST_POSTGRES_ADMIN_URL).password } });
}

async function verifyMarker(url, token) {
  await assertDisposableTestDatabase(url, token);
}

async function fixtures(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO users (id,name,email,role) VALUES ('restore-customer','Cliente Sintetico','restore-customer@example.invalid','customer')");
    await client.query("INSERT INTO rooms (id,name,capacity) VALUES ('restore-room','Sala Sintetica',10)");
    await client.query("INSERT INTO movies (id,title) VALUES ('restore-movie','Filme Sintetico')");
    await client.query("INSERT INTO sessions (id,movie_id,room_id,time_label,format,price_full,price_half) VALUES ('restore-session','restore-movie','restore-room','15:00','2D',10,5)");
    await client.query("INSERT INTO concessions (id,name,price) VALUES ('restore-popcorn','Pipoca Sintetica',8)");
    await client.query("INSERT INTO concession_inventory (concession_id,available,reserved,sold) VALUES ('restore-popcorn',17,1,2)");
    await client.query("INSERT INTO subscription_plans (id,name,monthly_price) VALUES ('restore-plan','Plano Sintetico',20)");
    await client.query("INSERT INTO subscriptions (id,user_id,plan_id,status,credits_available,credits_used,history) VALUES ('restore-sub','restore-customer','restore-plan','active',2,1,'[{\"event\":\"test\"}]'::jsonb)");
    await client.query("INSERT INTO subscription_credits (id,subscription_id,cycle_start,cycle_end,total,used,remaining) VALUES ('restore-credit','restore-sub','2026-10-01','2026-11-01',3,1,2)");
    await client.query("INSERT INTO orders (id,customer_user_id,customer_name,movie_id,session_id,status,total,metadata) VALUES ('restore-paid','restore-customer','Cliente Sintetico','restore-movie','restore-session','paid',10,'{\"ticketEmailRequested\":true}'::jsonb), ('restore-point','restore-customer','Cliente Sintetico','restore-movie','restore-session','pending_payment',10,'{}'::jsonb)");
    await client.query("INSERT INTO payments (id,order_id,method,provider,status,amount,metadata) VALUES ('restore-payment','restore-paid','cash','box_office','approved',10,'{}'::jsonb), ('restore-intent','restore-point','point_debit','mercado_pago','pending',10,$1::jsonb)", [JSON.stringify({ metadata: { kind: "point_sale", clientRequestId: "restore-intent-key", pointCreateState: "unknown", recoveryRequest: { externalReference: "restore-ref", idempotencyKey: "restore-key", totalPrice: 10 } } })]);
    await client.query("INSERT INTO tickets (id,order_id,movie_id,session_id,code,qr_payload,ticket_type,status) VALUES ('restore-ticket','restore-paid','restore-movie','restore-session','RESTORE-001','RESTORE-001','Inteira','active')");
    await client.query("INSERT INTO social_studio_automation_campaigns (id,cinema_id,idempotency_key,campaign_type,status) VALUES ('00000000-0000-4000-8000-000000000001','restore-cinema','restore-campaign-key','movie','queued')");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { await client.end(); }
}

async function invariants(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const migrationFiles = (await fs.readdir(path.join(__dirname, "../backend/db/migrations")))
      .filter((name) => name.endsWith(".sql"));
    const result = await client.query(`SELECT
      (SELECT count(*) FROM schema_migrations) AS migrations,
      (SELECT count(*) FROM movies WHERE id='restore-movie') AS movies,
      (SELECT count(*) FROM sessions s JOIN rooms r ON r.id=s.room_id WHERE s.id='restore-session') AS sessions,
      (SELECT count(*) FROM users WHERE id='restore-customer') AS customers,
      (SELECT count(*) FROM orders WHERE id IN ('restore-paid','restore-point')) AS orders,
      (SELECT count(*) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id IN ('restore-payment','restore-intent')) AS payments,
      (SELECT count(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.id='restore-ticket' AND t.status='active') AS tickets,
      (SELECT count(*) FROM concession_inventory WHERE concession_id='restore-popcorn' AND available=17 AND reserved=1 AND sold=2) AS inventory,
      (SELECT count(*) FROM subscription_credits c JOIN subscriptions s ON s.id=c.subscription_id WHERE c.id='restore-credit' AND c.total=3 AND c.used=1 AND c.remaining=2 AND s.credits_available=2) AS credits,
      (SELECT count(*) FROM ticket_email_jobs WHERE order_id='restore-paid' AND status='queued') AS jobs,
      (SELECT count(*) FROM social_studio_automation_campaigns WHERE cinema_id='restore-cinema' AND status='queued') AS campaigns,
      (SELECT count(*) FROM payments WHERE id='restore-intent' AND status='pending' AND metadata->'metadata'->>'pointCreateState'='unknown' AND metadata->'metadata'->'recoveryRequest'->>'idempotencyKey'='restore-key') AS intents`);
    const row = Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
    assert.equal(row.migrations, migrationFiles.length, "Todas as migrations versionadas devem estar presentes");
    for (const key of ["movies", "sessions", "customers", "tickets", "inventory", "credits", "jobs", "campaigns", "intents"]) assert.equal(row[key], 1, key);
    assert.equal(row.orders, 2);
    assert.equal(row.payments, 2);
    return row;
  } finally { await client.end(); }
}

async function main() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.TEST_DATABASE_URL) {
    throw new Error("Remova URLs de banco herdadas antes do ensaio de restauracao.");
  }
  process.env.NODE_ENV = "test";
  const adminUrl = parseAdminUrl(process.env.TEST_POSTGRES_ADMIN_URL);
  await assertDisposableTestServer(adminUrl.toString());
  const admin = new Client({ connectionString: adminUrl.toString() });
  const databases = [];
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-pg-restore-"));
  let connected = false;
  try {
    await admin.connect();
    connected = true;
    const role = await admin.query("SELECT rolsuper, rolcreatedb FROM pg_roles WHERE rolname=current_user");
    assert.equal(role.rows[0]?.rolsuper, false);
    assert.equal(role.rows[0]?.rolcreatedb, true);
    for (let index = 0; index < 2; index += 1) {
      const name = `cinecruzeiro_test_${crypto.randomBytes(8).toString("hex")}`;
      const token = crypto.randomBytes(16).toString("hex");
      const url = new URL(adminUrl);
      url.pathname = `/${name}`;
      await admin.query(`CREATE DATABASE "${name}"`);
      databases.push({ name, token, url: url.toString() });
      const client = new Client({ connectionString: url.toString() });
      await client.connect();
      try {
        await client.query("CREATE TABLE cine_test_database_marker (id integer PRIMARY KEY CHECK (id=1), token text NOT NULL)");
        await client.query("INSERT INTO cine_test_database_marker (id,token) VALUES (1,$1)", [token]);
      } finally { await client.end(); }
      await verifyMarker(url.toString(), token);
    }
    const [source, destination] = databases;
    run(process.execPath, [path.join(__dirname, "db-migrate.js")], {
      env: { ...process.env, DATABASE_URL: source.url, TEST_DATABASE_URL: source.url, CINE_TEST_DB_TOKEN: source.token }
    });
    await fixtures(source.url);
    const expected = await invariants(source.url);
    const archive = path.join(temp, "synthetic.dump");
    const dump = tool("pg_dump", ["-h", "127.0.0.1", "-U", "cine_test_admin", "-d", source.name,
      "-Fc", "--no-owner", "--no-acl", "--exclude-table=cine_test_database_marker"]);
    assert.ok(dump.length > 1024, "O arquivo de backup esta vazio ou incompleto.");
    await fs.writeFile(archive, dump, { flag: "wx" });
    await verifyMarker(destination.url, destination.token);
    tool("pg_restore", ["-h", "127.0.0.1", "-U", "cine_test_admin", "-d", destination.name,
      "--no-owner", "--no-acl", "--exit-on-error"], await fs.readFile(archive));
    await verifyMarker(destination.url, destination.token);
    const restored = await invariants(destination.url);
    assert.deepEqual(restored, expected);
    console.log(JSON.stringify({ result: "BACKUP_RESTORE_OK", source: source.name, destination: destination.name,
      bytes: dump.length, invariants: restored }));
  } finally {
    const cleanupErrors = [];
    if (connected) {
      for (const entry of databases.reverse()) {
        try {
          await verifyMarker(entry.url, entry.token);
          await admin.query(`DROP DATABASE "${entry.name}"`);
        } catch (error) {
          cleanupErrors.push(new Error(`Nao foi possivel limpar ${entry.name} com marcador verificado: ${error.message}`));
        }
      }
      try { await admin.end(); } catch (error) { cleanupErrors.push(error); }
    }
    if (temp.startsWith(path.join(os.tmpdir(), "cine-pg-restore-"))) {
      try { await fs.rm(temp, { recursive: true, force: true }); } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Limpeza do ensaio PostgreSQL incompleta");
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
