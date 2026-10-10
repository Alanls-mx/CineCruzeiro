const { Client } = require("pg");

const TEST_DATABASE_NAME = /^cinecruzeiro_test_[a-f0-9]{16}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseTestUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL do PostgreSQL de teste inválida."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname)
      || url.search || url.hash || decodeURIComponent(url.username) !== "cine_test_admin") {
    throw new Error("Testes destrutivos exigem PostgreSQL local, sem túnel ou host remoto.");
  }
  if (!TEST_DATABASE_NAME.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error("O banco de teste precisa ter o nome descartável gerado pelo harness.");
  }
  return url;
}

async function assertDisposableTestDatabase(value = process.env.TEST_DATABASE_URL, token = process.env.CINE_TEST_DB_TOKEN) {
  if (process.env.NODE_ENV !== "test" || !token || !/^[a-f0-9]{32}$/.test(token)) {
    throw new Error("Banco de teste sem execução autorizada. Nenhuma migration ou reset foi iniciado.");
  }
  const url = parseTestUrl(value);
  for (const operational of [process.env.OPERATIONAL_DATABASE_URL, process.env.PRODUCTION_DATABASE_URL, process.env.DEVELOPMENT_DATABASE_URL]) {
    if (operational && operational === value) throw new Error("A URL de teste coincide com um banco operacional.");
  }
  const client = new Client({ connectionString: value });
  await client.connect();
  try {
    const result = await client.query("SELECT token FROM cine_test_database_marker WHERE id = 1");
    if (result.rowCount !== 1 || result.rows[0].token !== token) throw new Error("Marcador do banco descartável não confere.");
    const identity = await client.query("SELECT current_database() AS name");
    if (identity.rows[0].name !== decodeURIComponent(url.pathname.slice(1))) throw new Error("Identidade do banco de teste não confere.");
  } finally {
    await client.end();
  }
}

module.exports = { assertDisposableTestDatabase, parseTestUrl, TEST_DATABASE_NAME, LOCAL_HOSTS };
