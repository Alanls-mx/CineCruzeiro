const crypto = require("crypto");
const { Client } = require("pg");

function keyFrom(value, name) {
  if (!value) throw new Error(`Configure ${name}.`);
  return crypto.createHash("sha256").update(value).digest();
}

function decrypt(record, key) {
  const [ivRaw, tagRaw, encryptedRaw] = String(record.value || "").split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Registro criptografado invalido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
}

function encrypt(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encrypted: true,
    value: `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`
  };
}

function rotate(value, oldKey, newKey, state) {
  if (Array.isArray(value)) return value.map((item) => rotate(item, oldKey, newKey, state));
  if (!value || typeof value !== "object") return value;
  if (value.encrypted === true && typeof value.value === "string") {
    state.count += 1;
    return encrypt(decrypt(value, oldKey), newKey);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rotate(item, oldKey, newKey, state)]));
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Configure DATABASE_URL ou POSTGRES_URL.");
  const oldKey = keyFrom(process.env.OLD_INTEGRATION_SECRET_KEY, "OLD_INTEGRATION_SECRET_KEY");
  const newKey = keyFrom(process.env.INTEGRATION_SECRET_KEY, "INTEGRATION_SECRET_KEY");
  if (process.env.OLD_INTEGRATION_SECRET_KEY === process.env.INTEGRATION_SECRET_KEY) {
    throw new Error("As chaves antiga e nova devem ser diferentes.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT value FROM settings WHERE key = 'app' FOR UPDATE");
    if (!result.rowCount) throw new Error("Configuracao principal nao encontrada.");
    const state = { count: 0 };
    const rotated = rotate(result.rows[0].value || {}, oldKey, newKey, state);
    if (!state.count) throw new Error("Nenhum segredo criptografado foi encontrado; rotacao cancelada.");
    await client.query("UPDATE settings SET value = $1, updated_at = now() WHERE key = 'app'", [rotated]);
    await client.query("COMMIT");
    console.log(`Segredos de integracao rotacionados: ${state.count}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
