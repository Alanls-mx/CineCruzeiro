const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");

const OLD_COMMIT = "ea7c5df24cf44d64516d00d81585cb2b0f7efe09";
const migrationsDir = path.join(__dirname, "..", "backend", "db", "migrations");

function git(args) {
  const result = spawnSync("git", args, { cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Historico da release antiga indisponivel: ${result.stderr || result.error?.message}`);
  return result.stdout;
}

async function migrationFiles() {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const previous = git(["ls-tree", "-r", "--name-only", OLD_COMMIT, "--", "backend/db/migrations"])
    .trim().split("\n").map((file) => path.basename(file)).filter(Boolean).sort();
  assert.deepEqual(files.filter((file) => file <= "050_room_cleanup_minutes.sql"), previous,
    "O conjunto de migrations ate 050 precisa coincidir com a release instalada");
  for (const file of previous) {
    const oldSql = git(["show", `${OLD_COMMIT}:backend/db/migrations/${file}`]);
    assert.equal((await fs.readFile(path.join(migrationsDir, file), "utf8")).replace(/\r\n/g, "\n"), oldSql.replace(/\r\n/g, "\n"),
      `Migration antiga modificada: ${file}`);
  }
  assert.deepEqual(files.slice(previous.length), ["051_ticket_email_jobs.sql", "052_point_payment_methods.sql"]);
  return { previous, files };
}

async function apply(client, file, record = true) {
  const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    if (record) await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function availablePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function oldReleaseProbe(sourceDir, databaseUrl, stage) {
  const port = await availablePort();
  const environment = {
    PATH: process.env.PATH,
    NODE_PATH: path.join(__dirname, "..", "node_modules"),
    NODE_ENV: "test",
    DATA_STORE: "postgres",
    DATABASE_URL: databaseUrl,
    PORT: String(port),
    HOST: "127.0.0.1",
    JWT_SECRET: "synthetic-upgrade-test-only",
    CINE_TEST_DB_TOKEN: process.env.CINE_TEST_DB_TOKEN,
    TEST_DATABASE_URL: databaseUrl,
    TEST_POSTGRES_ADMIN_URL: process.env.TEST_POSTGRES_ADMIN_URL,
    CINE_TEST_SERVER_TOKEN: process.env.CINE_TEST_SERVER_TOKEN
  };
  const child = spawn(process.execPath, [path.join(sourceDir, "backend", "server.js")], {
    cwd: sourceDir, env: environment, stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
    output = (output + chunk.toString("utf8")).slice(-4000);
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) break;
      let response;
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, { signal: AbortSignal.timeout(1000) });
      } catch { /* Aguardar startup isolado. */ }
      if (response?.ok) {
          const catalog = await fetch(`http://127.0.0.1:${port}/api/content`, { signal: AbortSignal.timeout(2000) });
          assert.equal(catalog.status, 200, `A release antiga nao leu o catalogo no esquema ${stage}`);
          if (stage === "052") {
            const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: "upgrade@example.invalid", password: "upgrade-synthetic-123" }),
              signal: AbortSignal.timeout(2000)
            });
            assert.equal(login.status, 200, "Login legado no esquema 052");
            const cookie = login.headers.get("set-cookie")?.split(";")[0];
            assert.ok(cookie?.startsWith("cine_customer="));
            const ticket = await fetch(`http://127.0.0.1:${port}/api/me/tickets/upgrade-ticket`, {
              headers: { Cookie: cookie }, signal: AbortSignal.timeout(2000)
            });
            assert.equal(ticket.status, 200, "Direito pago legivel pelo codigo antigo no esquema 052");
            assert.equal((await ticket.json()).ticket.id, "upgrade-ticket");
          }
          ready = true;
          break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, `Release antiga nao iniciou no esquema ${stage}: ${output}`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 3000))
    ]);
  }
}

async function withOldRelease(fn) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-old-upgrade-"));
  try {
    const archive = path.join(temp, "old.tar");
    const result = spawnSync("git", ["archive", "--format=tar", "--output", archive, OLD_COMMIT,
      "backend", "config", "scripts", "package.json"], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || "Nao foi possivel extrair a release antiga");
    const extract = spawnSync("tar", ["-xf", archive, "-C", temp], { encoding: "utf8" });
    assert.equal(extract.status, 0, extract.stderr || "Nao foi possivel abrir a release antiga");
    await fn(temp);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  await assertDisposableTestDatabase(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
    assert.ok(version >= 180000 && version < 190000, "O ensaio requer PostgreSQL 18 descartavel");
    const { previous, files } = await migrationFiles();
    await client.query("CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    for (const file of previous) await apply(client, file);
    const salt = crypto.randomBytes(16).toString("base64url");
    const passwordHash = `pbkdf2_sha256$600000$${salt}$${crypto.pbkdf2Sync("upgrade-synthetic-123", salt, 600000, 32, "sha256").toString("base64url")}`;
    await client.query("INSERT INTO users (id,name,email,role,password_hash) VALUES ('upgrade-user','Pessoa Sintetica','upgrade@example.invalid','customer',$1)", [passwordHash]);
    await client.query(`INSERT INTO orders (id,customer_user_id,customer_name,status,total,metadata)
      VALUES ('upgrade-paid','upgrade-user','Pessoa Sintetica','paid',10,'{"ticketEmailRequested":true}'),
             ('upgrade-pending','upgrade-user','Pessoa Sintetica','pending_payment',10,'{"ticketEmailRequested":true}'),
             ('upgrade-no-mail','upgrade-user','Pessoa Sintetica','pending_payment',10,'{}')`);
    await client.query(`INSERT INTO payments (id,order_id,method,provider,status,amount)
      VALUES ('upgrade-pix','upgrade-paid','pix','mercado_pago','approved',10)`);
    await withOldRelease((sourceDir) => oldReleaseProbe(sourceDir, url, "050"));
    const before = await client.query("SELECT to_regclass('ticket_email_jobs') AS jobs, count(*)::int AS orders FROM orders");
    assert.equal(before.rows[0].jobs, null);
    assert.equal(before.rows[0].orders, 3);

    await client.query("BEGIN");
    await client.query(await fs.readFile(path.join(migrationsDir, files[previous.length]), "utf8"));
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT to_regclass('ticket_email_jobs') AS jobs")).rows[0].jobs, null);

    await apply(client, "051_ticket_email_jobs.sql");
    assert.equal((await client.query("SELECT count(*)::int AS total FROM ticket_email_jobs")).rows[0].total, 0,
      "A migration nao deve reenviar pedidos pagos antigos");
    await client.query("UPDATE orders SET status='paid' WHERE id IN ('upgrade-pending','upgrade-no-mail')");
    assert.deepEqual((await client.query("SELECT order_id FROM ticket_email_jobs ORDER BY order_id")).rows.map((row) => row.order_id),
      ["upgrade-pending"]);
    await client.query("UPDATE orders SET status='paid' WHERE id='upgrade-pending'");
    assert.equal((await client.query("SELECT count(*)::int AS total FROM ticket_email_jobs")).rows[0].total, 1);

    await client.query("BEGIN");
    await client.query(await fs.readFile(path.join(migrationsDir, "052_point_payment_methods.sql"), "utf8"));
    await client.query("ROLLBACK");
    const blocker = new Client({ connectionString: url });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("UPDATE payments SET status=status WHERE id='upgrade-pix'");
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='150ms'");
      await assert.rejects(client.query(await fs.readFile(path.join(migrationsDir, "052_point_payment_methods.sql"), "utf8")),
        (error) => error.code === "55P03", "DDL concorrente deve respeitar lock_timeout");
      await client.query("ROLLBACK");
    } finally {
      await blocker.query("ROLLBACK");
      await blocker.end();
    }
    await assert.rejects(client.query(`INSERT INTO payments (id,order_id,method,provider,status,amount)
      VALUES ('upgrade-point-before','upgrade-pending','point_debit','mercado_pago','pending',10)`), /payments_method_check/);
    await apply(client, "052_point_payment_methods.sql");
    await client.query(`INSERT INTO payments (id,order_id,method,provider,status,amount)
      VALUES ('upgrade-point-after','upgrade-pending','point_debit','mercado_pago','pending',10)`);
    const check = await client.query("SELECT convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='payments_method_check' AND conrelid='payments'::regclass");
    assert.equal(check.rows.length, 1);
    assert.equal(check.rows[0].convalidated, true);
    assert.match(check.rows[0].definition, /point_debit/);
    assert.equal((await client.query("SELECT count(*)::int AS total FROM schema_migrations")).rows[0].total, files.length);
    assert.equal((await client.query("SELECT count(*)::int AS total FROM payments")).rows[0].total, 2);
    await client.query(`INSERT INTO tickets (id,order_id,code,qr_payload,ticket_type,customer_name,customer_email)
      VALUES ('upgrade-ticket','upgrade-paid','upgrade-code','upgrade-qr','inteira','Pessoa Sintetica','upgrade@example.invalid')`);
    await withOldRelease((sourceDir) => oldReleaseProbe(sourceDir, url, "052"));
    const rerun = spawnSync(process.execPath, [path.join(__dirname, "db-migrate.js")], {
      cwd: path.join(__dirname, ".."), encoding: "utf8", env: { ...process.env, DATABASE_URL: url, POSTGRES_URL: "" }
    });
    assert.equal(rerun.status, 0, rerun.stderr || "Reexecucao das migrations falhou");
    assert.equal((await client.query("SELECT count(*)::int AS total FROM schema_migrations")).rows[0].total, files.length);
    console.log(`PG18_UPGRADE_OK migrations=${files.length} previous=${previous.length} synthetic_orders=3`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
