const { Client } = require("pg");
const { randomBytes } = require("crypto");
const { spawnSync } = require("child_process");
const path = require("path");
const { parseAdminUrl, assertDisposableTestServer } = require("./test-postgres-safety");

function adminUrl() {
  const value = process.env.TEST_POSTGRES_ADMIN_URL;
  if (!value) throw new Error("Configure TEST_POSTGRES_ADMIN_URL com o role local cine_test_admin (CREATEDB).");
  return parseAdminUrl(value);
}

async function main() {
  const target = process.argv[2];
  if (!["smoke", "concurrency", "repositories"].includes(target)) throw new Error("Escolha smoke, concurrency ou repositories.");
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.TEST_DATABASE_URL) {
    throw new Error("Remova URLs de banco herdadas antes de iniciar o harness de teste.");
  }
  process.env.NODE_ENV = "test";
  const baseUrl = adminUrl();
  await assertDisposableTestServer(baseUrl.toString());
  const databaseName = `cinecruzeiro_test_${randomBytes(8).toString("hex")}`;
  const token = randomBytes(16).toString("hex");
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = new Client({ connectionString: baseUrl.toString() });
  await admin.connect();
  let created = false;
  let marked = false;
  try {
    const role = await admin.query("SELECT current_user AS name, r.rolsuper, r.rolcreatedb FROM pg_roles r WHERE r.rolname = current_user");
    if (role.rows[0]?.name !== "cine_test_admin" || role.rows[0]?.rolsuper || !role.rows[0]?.rolcreatedb) {
      throw new Error("O role local cine_test_admin deve ser não-superusuário e ter CREATEDB.");
    }
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const testClient = new Client({ connectionString: testUrl.toString() });
    await testClient.connect();
    try {
      await testClient.query("CREATE TABLE cine_test_database_marker (id integer PRIMARY KEY CHECK (id = 1), token text NOT NULL)");
      await testClient.query("INSERT INTO cine_test_database_marker (id, token) VALUES (1, $1)", [token]);
      marked = true;
    } finally { await testClient.end(); }
    const script = path.join(__dirname, target === "smoke" ? "smoke-tests.js"
      : target === "repositories" ? "postgres-repository-tests.js" : "postgres-concurrency-tests.js");
    const child = spawnSync(process.execPath, [script], {
      cwd: path.join(__dirname, ".."), stdio: "inherit",
      env: {
        ...process.env, NODE_ENV: "test", DATA_STORE: "postgres", TEST_DATABASE_URL: testUrl.toString(),
        DATABASE_URL: testUrl.toString(), POSTGRES_URL: "", CINE_TEST_DB_TOKEN: token,
        CINE_SMOKE_MODE: target === "smoke" ? "postgres" : ""
      }
    });
    if (child.error) throw child.error;
    if (child.status !== 0) process.exitCode = child.status || 1;
  } finally {
    try {
      if (created) {
        if (marked) {
          const verify = new Client({ connectionString: testUrl.toString() });
          try {
            await verify.connect();
            const marker = await verify.query("SELECT token FROM cine_test_database_marker WHERE id = 1");
            if (marker.rows[0]?.token !== token) throw new Error("Marcador divergente; banco não será removido.");
          } finally { await verify.end().catch(() => {}); }
        }
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      }
    } finally { await admin.end(); }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
