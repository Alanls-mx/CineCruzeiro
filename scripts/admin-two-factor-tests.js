const assert = require("assert/strict");

process.env.TWO_FACTOR_SECRET_KEY = "admin-two-factor-unit-test-key";

const twoFactor = require("../backend/services/adminTwoFactorService");

function run() {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(twoFactor.totp(rfcSecret, { timestamp: 59_000, digits: 8 }), "94287082");

  const secret = twoFactor.generateSecret();
  const code = twoFactor.totp(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(twoFactor.verifyTotp(secret, code), true);
  assert.equal(twoFactor.verifyTotp(secret, "000000", { window: 0 }), code === "000000");

  const encrypted = twoFactor.encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(twoFactor.decryptSecret(encrypted), secret);
  assert.equal(twoFactor.decryptSecret(`${encrypted}corrompido`), "");
  const [version, iv, tag, ciphertext] = encrypted.split(":");
  const shortenedTag = Buffer.from(tag, "base64url").subarray(0, 8).toString("base64url");
  assert.equal(twoFactor.decryptSecret([version, iv, shortenedTag, ciphertext].join(":")), "");

  const recoveryCodes = twoFactor.generateRecoveryCodes();
  assert.equal(recoveryCodes.length, 10);
  assert.equal(new Set(recoveryCodes).size, recoveryCodes.length);
  const hashes = recoveryCodes.map(twoFactor.hashRecoveryCode);
  assert.equal(twoFactor.recoveryCodeIndex(hashes, recoveryCodes[3]), 3);
  assert.equal(twoFactor.recoveryCodeIndex(hashes, "CODIGO-INVALIDO"), -1);

  const protectedKeys = ["TWO_FACTOR_RECOVERY_PEPPER", "TWO_FACTOR_SECRET_KEY", "INTEGRATION_SECRET_KEY", "JWT_SECRET"];
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecrets = Object.fromEntries(protectedKeys.map((key) => [key, process.env[key]]));
  process.env.NODE_ENV = "production";
  protectedKeys.forEach((key) => delete process.env[key]);
  assert.throws(
    () => twoFactor.hashRecoveryCode(recoveryCodes[0]),
    (error) => error?.code === "ADMIN_2FA_RECOVERY_PEPPER_REQUIRED"
  );
  protectedKeys.forEach((key) => {
    if (previousSecrets[key] === undefined) delete process.env[key];
    else process.env[key] = previousSecrets[key];
  });
  if (previousEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnvironment;

  const uri = twoFactor.otpauthUrl(secret, "admin@cinecruzeiro.local");
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /issuer=Cine(?:%20|\+)Cruzeiro/);
  assert.doesNotMatch(uri, /\s/);

  console.log("Admin 2FA tests passed.");
}

run();
