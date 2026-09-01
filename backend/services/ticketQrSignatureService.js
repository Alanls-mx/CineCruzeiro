const crypto = require("crypto");
const fs = require("fs");

const PREFIX = "CC2";
let cachedKeys = null;

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function envPem(name, fileName) {
  const direct = String(process.env[name] || "").replace(/\\n/g, "\n").trim();
  if (direct) return direct;
  const file = String(process.env[fileName] || "").trim();
  return file && fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
}

function keys() {
  if (cachedKeys) return cachedKeys;
  const privatePem = envPem("TICKET_QR_PRIVATE_KEY_PEM", "TICKET_QR_PRIVATE_KEY_FILE");
  const publicPem = envPem("TICKET_QR_PUBLIC_KEY_PEM", "TICKET_QR_PUBLIC_KEY_FILE");
  let privateKey;
  let publicKey;
  if (privatePem) {
    privateKey = crypto.createPrivateKey(privatePem);
    publicKey = publicPem ? crypto.createPublicKey(publicPem) : crypto.createPublicKey(privateKey);
  } else {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Configure TICKET_QR_PRIVATE_KEY_FILE ou TICKET_QR_PRIVATE_KEY_PEM em produção.");
      error.code = "TICKET_QR_SIGNING_KEY_REQUIRED";
      throw error;
    }
    const generated = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    privateKey = generated.privateKey;
    publicKey = generated.publicKey;
  }
  const spki = publicKey.export({ type: "spki", format: "der" });
  cachedKeys = {
    privateKey,
    publicKey,
    kid: String(process.env.TICKET_QR_KEY_ID || crypto.createHash("sha256").update(spki).digest("hex").slice(0, 16))
  };
  return cachedKeys;
}

function expirationEpoch(ticket) {
  const date = String(ticket.sessionDate || "").trim();
  const time = /^\d{2}:\d{2}$/.test(String(ticket.sessionTime || "")) ? ticket.sessionTime : "23:59";
  const session = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T${time}:00-03:00`) : null;
  return Math.floor(((session && Number.isFinite(session.getTime()) ? session.getTime() : Date.now()) + 4 * 60 * 60 * 1000) / 1000);
}

function payloadForTicket(ticket) {
  return {
    v: 2,
    k: keys().kid,
    t: String(ticket.id || ""),
    c: String(ticket.code || ""),
    s: String(ticket.sessionId || ""),
    m: String(ticket.movieId || ""),
    n: Number(ticket.ticketNumber || 0),
    i: Math.floor(new Date(ticket.createdAt || Date.now()).getTime() / 1000),
    e: expirationEpoch(ticket)
  };
}

function signTicket(ticket) {
  const encoded = base64url(JSON.stringify(payloadForTicket(ticket)));
  const signingInput = `${PREFIX}.${encoded}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: keys().privateKey,
    dsaEncoding: "ieee-p1363"
  });
  return `${signingInput}.${base64url(signature)}`;
}

function verify(payload) {
  const parts = String(payload || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const valid = crypto.verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), {
    key: keys().publicKey,
    dsaEncoding: "ieee-p1363"
  }, Buffer.from(parts[2], "base64url"));
  if (!valid || data.v !== 2 || data.k !== keys().kid || !data.t || !data.c || !data.s) return null;
  return data;
}

function publicConfig() {
  return {
    version: 2,
    kid: keys().kid,
    algorithm: "ECDSA_P256_SHA256",
    jwk: keys().publicKey.export({ format: "jwk" })
  };
}

function resetForTests() {
  cachedKeys = null;
}

module.exports = { PREFIX, publicConfig, signTicket, verify, resetForTests };
