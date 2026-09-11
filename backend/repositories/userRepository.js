const { timedQuery, runMutation } = require("./repositorySupport");

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone || "", cpf: row.cpf || "",
    passwordHash: row.password_hash || "", authProvider: row.auth_provider || "email",
    googleSub: row.google_sub || "", picture: row.picture || "", emailVerified: Boolean(row.email_verified),
    pendingEmail: row.pending_email || "", emailVerificationHash: row.email_verification_hash || "",
    emailVerificationExpiresAt: iso(row.email_verification_expires_at),
    emailVerificationRequestedAt: iso(row.email_verification_requested_at),
    passwordResetHash: row.password_reset_hash || "", passwordResetExpiresAt: iso(row.password_reset_expires_at),
    passwordResetRequestedAt: iso(row.password_reset_requested_at), emailUnsubscribedAt: iso(row.email_unsubscribed_at),
    emailUnsubscribeToken: row.email_unsubscribe_token || "", twoFactorEnabled: Boolean(row.two_factor_enabled),
    twoFactorSecret: row.two_factor_secret || "", twoFactorPendingSecret: row.two_factor_pending_secret || "",
    twoFactorRecoveryCodes: Array.isArray(row.two_factor_recovery_codes) ? row.two_factor_recovery_codes : [],
    twoFactorConfirmedAt: iso(row.two_factor_confirmed_at), twoFactorUpdatedAt: iso(row.two_factor_updated_at),
    adminPermissions: Array.isArray(row.admin_permissions) ? row.admin_permissions : [],
    useCustomPermissions: Boolean(row.use_custom_permissions), sessionVersion: Number(row.session_version || 0),
    role: row.role || "customer", active: row.active !== false, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}

async function findById(id, client = null, lock = false) {
  const result = await timedQuery(client, `SELECT * FROM users WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id], { repository: "user", operation: "findById" });
  return mapUser(result.rows[0]);
}

async function findByEmail(email) {
  const result = await timedQuery(null, "SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1", [String(email || "")], { repository: "user", operation: "findByEmail" });
  return mapUser(result.rows[0]);
}

async function findByGoogleSub(googleSub) {
  const result = await timedQuery(null, "SELECT * FROM users WHERE google_sub=NULLIF($1,'') LIMIT 1", [String(googleSub || "")], { repository: "user", operation: "findByGoogleSub" });
  return mapUser(result.rows[0]);
}

async function findByPasswordResetHash(hash) {
  const result = await timedQuery(null, `SELECT * FROM users
    WHERE password_reset_hash=$1 AND active=true AND auth_provider<>'google'
      AND password_reset_expires_at>now() LIMIT 1`, [String(hash || "")], { repository: "user", operation: "findByPasswordReset" });
  return mapUser(result.rows[0]);
}

async function findByEmailVerificationHash(hash) {
  const result = await timedQuery(null, `SELECT * FROM users
    WHERE email_verification_hash=$1 AND active=true AND email_verification_expires_at>now() LIMIT 1`, [String(hash || "")], { repository: "user", operation: "findByEmailVerification" });
  return mapUser(result.rows[0]);
}

async function emailExists(email, excludeId = "") {
  const result = await timedQuery(null, "SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>NULLIF($2,'') LIMIT 1", [String(email || ""), String(excludeId || "")], { repository: "user", operation: "emailExists" });
  return result.rowCount > 0;
}

async function countActiveOwners() {
  const result = await timedQuery(null, "SELECT count(*)::int AS total FROM users WHERE role IN ('owner','master') AND active=true", [], { repository: "user", operation: "countActiveOwners" });
  return Number(result.rows[0]?.total || 0);
}

const FIELD_COLUMNS = {
  name: "name", email: "email", phone: "phone", cpf: "cpf", passwordHash: "password_hash",
  authProvider: "auth_provider", googleSub: "google_sub", picture: "picture", emailVerified: "email_verified",
  pendingEmail: "pending_email", emailVerificationHash: "email_verification_hash",
  emailVerificationExpiresAt: "email_verification_expires_at", emailVerificationRequestedAt: "email_verification_requested_at",
  passwordResetHash: "password_reset_hash", passwordResetExpiresAt: "password_reset_expires_at",
  passwordResetRequestedAt: "password_reset_requested_at", emailUnsubscribedAt: "email_unsubscribed_at",
  emailUnsubscribeToken: "email_unsubscribe_token", twoFactorEnabled: "two_factor_enabled",
  twoFactorSecret: "two_factor_secret", twoFactorPendingSecret: "two_factor_pending_secret",
  twoFactorRecoveryCodes: "two_factor_recovery_codes", twoFactorConfirmedAt: "two_factor_confirmed_at",
  twoFactorUpdatedAt: "two_factor_updated_at", adminPermissions: "admin_permissions",
  useCustomPermissions: "use_custom_permissions", sessionVersion: "session_version", role: "role", active: "active"
};
const JSON_FIELDS = new Set(["twoFactorRecoveryCodes", "adminPermissions"]);
const DATE_FIELDS = new Set(["emailVerificationExpiresAt", "emailVerificationRequestedAt", "passwordResetExpiresAt", "passwordResetRequestedAt", "emailUnsubscribedAt", "twoFactorConfirmedAt", "twoFactorUpdatedAt"]);

async function updateFields(id, fields, options = {}) {
  const entries = Object.entries(fields || {}).filter(([key]) => FIELD_COLUMNS[key]);
  if (!entries.length) return findById(id);
  return runMutation({
    event: options.event || "repository.user.security_update",
    metadata: { repository: "user", operation: options.operation || "update", userId: id, fields: entries.map(([key]) => key).join(",") },
    audit: options.audit
  }, async (client) => {
    if (options.protectLastOwner === true) {
      const owners = await timedQuery(client, `SELECT id FROM users
        WHERE role IN ('owner','master') AND active=true ORDER BY id FOR UPDATE`, [], { repository: "user", operation: "owners.lock" });
      const current = await findById(id, client, true);
      const nextRole = fields.role === "master" ? "owner" : (fields.role || current?.role);
      const nextActive = fields.active === undefined ? current?.active !== false : fields.active !== false;
      if (current && ["owner", "master"].includes(current.role) && current.active !== false
        && (nextRole !== "owner" || !nextActive) && owners.rowCount <= 1) {
        throw Object.assign(new Error("Mantenha ao menos uma conta de dono ativa no painel."), {
          statusCode: 409, code: "LAST_OWNER_REQUIRED"
        });
      }
    }
    const values = [id];
    const assignments = entries.map(([key, value]) => {
      values.push(JSON_FIELDS.has(key) ? JSON.stringify(value || []) : value);
      const parameter = `$${values.length}`;
      if (JSON_FIELDS.has(key)) return `${FIELD_COLUMNS[key]}=${parameter}::jsonb`;
      if (DATE_FIELDS.has(key)) return `${FIELD_COLUMNS[key]}=NULLIF(${parameter},'')::timestamptz`;
      if (["googleSub", "pendingEmail", "emailVerificationHash", "passwordResetHash", "emailUnsubscribeToken", "twoFactorSecret", "twoFactorPendingSecret"].includes(key)) return `${FIELD_COLUMNS[key]}=NULLIF(${parameter},'')`;
      return `${FIELD_COLUMNS[key]}=${parameter}`;
    });
    const sessionIncrement = options.incrementSessionVersion === true ? ",session_version=session_version+1" : "";
    const result = await timedQuery(client, `UPDATE users SET ${assignments.join(",")}${sessionIncrement},updated_at=now() WHERE id=$1 RETURNING *`, values, { repository: "user", operation: options.operation || "update" });
    return mapUser(result.rows[0]);
  });
}

async function create(user, options = {}) {
  return runMutation({
    event: "repository.user.create", metadata: { repository: "user", operation: "create", userId: user.id }, audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO users
      (id,name,email,phone,cpf,password_hash,auth_provider,google_sub,picture,email_verified,pending_email,
       email_verification_hash,email_verification_expires_at,email_verification_requested_at,password_reset_hash,
       password_reset_expires_at,password_reset_requested_at,email_unsubscribed_at,email_unsubscribe_token,
       two_factor_enabled,two_factor_secret,two_factor_pending_secret,two_factor_recovery_codes,two_factor_confirmed_at,
       two_factor_updated_at,admin_permissions,use_custom_permissions,session_version,role,active,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),$7,NULLIF($8,''),$9,$10,NULLIF($11,''),NULLIF($12,''),NULLIF($13,'')::timestamptz,
       NULLIF($14,'')::timestamptz,NULLIF($15,''),NULLIF($16,'')::timestamptz,NULLIF($17,'')::timestamptz,
       NULLIF($18,'')::timestamptz,NULLIF($19,''),$20,NULLIF($21,''),NULLIF($22,''),$23::jsonb,NULLIF($24,'')::timestamptz,
       NULLIF($25,'')::timestamptz,$26::jsonb,$27,$28,$29,$30,COALESCE(NULLIF($31,'')::timestamptz,now()),now()) RETURNING *`, [
      user.id,user.name,user.email,user.phone || "",user.cpf || "",user.passwordHash || "",user.authProvider || "email",user.googleSub || "",
      user.picture || "",Boolean(user.emailVerified),user.pendingEmail || "",user.emailVerificationHash || "",user.emailVerificationExpiresAt || "",
      user.emailVerificationRequestedAt || "",user.passwordResetHash || "",user.passwordResetExpiresAt || "",user.passwordResetRequestedAt || "",
      user.emailUnsubscribedAt || "",user.emailUnsubscribeToken || "",Boolean(user.twoFactorEnabled),user.twoFactorSecret || "",
      user.twoFactorPendingSecret || "",JSON.stringify(user.twoFactorRecoveryCodes || []),user.twoFactorConfirmedAt || "",user.twoFactorUpdatedAt || "",
      JSON.stringify(user.adminPermissions || []),Boolean(user.useCustomPermissions),Number(user.sessionVersion || 0),user.role || "customer",user.active !== false,user.createdAt || ""
    ], { repository: "user", operation: "create" });
    return mapUser(result.rows[0]);
  });
}

async function updateAdmin(user, options = {}) {
  const adminFields = [
    "name", "email", "phone", "cpf", "passwordHash", "authProvider", "role", "active",
    "adminPermissions", "useCustomPermissions"
  ];
  return updateFields(user.id, Object.fromEntries(adminFields.filter((key) => user[key] !== undefined).map((key) => [key, user[key]])), {
    ...options, event: "repository.user.admin_update", operation: "adminUpdate"
  });
}

async function incrementSessionVersion(id, options = {}) {
  return runMutation({
    event: "repository.user.session_version", metadata: { repository: "user", operation: "sessionVersion", userId: id }, audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, "UPDATE users SET session_version=session_version+1,updated_at=now() WHERE id=$1 RETURNING *", [id], { repository: "user", operation: "sessionVersion" });
    return mapUser(result.rows[0]);
  });
}

async function resetPassword(id, expectedHash, passwordHash, authProvider = "email") {
  return runMutation({ event: "repository.user.password_reset", metadata: { repository: "user", operation: "passwordReset", userId: id } }, async (client) => {
    const result = await timedQuery(client, `UPDATE users SET password_hash=$3,auth_provider=$4,
      session_version=session_version+1,password_reset_hash=NULL,password_reset_expires_at=NULL,
      password_reset_requested_at=NULL,updated_at=now()
      WHERE id=$1 AND password_reset_hash=$2 AND password_reset_expires_at>now() RETURNING *`,
    [id, expectedHash, passwordHash, authProvider || "email"], { repository: "user", operation: "passwordReset" });
    return mapUser(result.rows[0]);
  });
}

async function confirmEmail(id, expectedHash, pendingEmail) {
  return runMutation({ event: "repository.user.email_verification", metadata: { repository: "user", operation: "emailVerification", userId: id } }, async (client) => {
    const result = await timedQuery(client, `UPDATE users SET email=$3,pending_email=NULL,email_verified=true,
      email_verification_hash=NULL,email_verification_expires_at=NULL,email_verification_requested_at=NULL,updated_at=now()
      WHERE id=$1 AND email_verification_hash=$2 AND email_verification_expires_at>now()
        AND pending_email=$3 RETURNING *`, [id, expectedHash, pendingEmail], { repository: "user", operation: "emailVerification" });
    return mapUser(result.rows[0]);
  });
}

async function consumeRecoveryCode(id, expectedCodes, remainingCodes) {
  return runMutation({ event: "repository.user.recovery_code", metadata: { repository: "user", operation: "recoveryCode", userId: id } }, async (client) => {
    const result = await timedQuery(client, `UPDATE users SET two_factor_recovery_codes=$3::jsonb,two_factor_updated_at=now(),updated_at=now()
      WHERE id=$1 AND two_factor_recovery_codes=$2::jsonb RETURNING *`, [id, JSON.stringify(expectedCodes || []), JSON.stringify(remainingCodes || [])], { repository: "user", operation: "recoveryCode" });
    return mapUser(result.rows[0]);
  });
}

async function remove(id, options = {}) {
  return runMutation({ event: "repository.user.delete", metadata: { repository: "user", operation: "delete", userId: id }, audit: options.audit }, async (client) => {
    const owners = await timedQuery(client, `SELECT id FROM users
      WHERE role IN ('owner','master') AND active=true ORDER BY id FOR UPDATE`, [], { repository: "user", operation: "owners.lock" });
    const before = await findById(id, client, true);
    if (before && ["owner", "master"].includes(before.role) && before.active !== false && owners.rowCount <= 1) {
      throw Object.assign(new Error("A última conta de dono ativa não pode ser excluída."), {
        statusCode: 409, code: "LAST_OWNER_REQUIRED"
      });
    }
    await timedQuery(client, "UPDATE orders SET customer_user_id=NULL WHERE customer_user_id=$1", [id], { repository: "user", operation: "orders.detach" });
    await timedQuery(client, "UPDATE subscriptions SET assigned_by=NULL WHERE assigned_by=$1", [id], { repository: "user", operation: "subscriptions.assignee.detach" });
    await timedQuery(client, "UPDATE subscriptions SET archived_by=NULL WHERE archived_by=$1", [id], { repository: "user", operation: "subscriptions.archiver.detach" });
    await timedQuery(client, "UPDATE audit_logs SET user_id=NULL WHERE user_id=$1", [id], { repository: "user", operation: "audit.detach" });
    await timedQuery(client, `DELETE FROM subscription_credit_redemptions
      WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id=$1)`, [id], { repository: "user", operation: "subscription_redemptions.delete" });
    await timedQuery(client, "DELETE FROM subscription_credit_units WHERE customer_id=$1", [id], { repository: "user", operation: "subscription_credit_units.delete" });
    await timedQuery(client, "DELETE FROM subscription_payments WHERE customer_id=$1", [id], { repository: "user", operation: "subscription_payments.delete" });
    await timedQuery(client, "DELETE FROM subscription_cycles WHERE customer_id=$1", [id], { repository: "user", operation: "subscription_cycles.delete" });
    await timedQuery(client, "DELETE FROM subscription_usage WHERE user_id=$1", [id], { repository: "user", operation: "subscription_usage.delete" });
    await timedQuery(client, "DELETE FROM subscriptions WHERE user_id=$1", [id], { repository: "user", operation: "subscriptions.delete" });
    await timedQuery(client, "DELETE FROM users WHERE id=$1", [id], { repository: "user", operation: "delete" });
    return before;
  });
}

module.exports = {
  mapUser, findById, findByEmail, findByGoogleSub, findByPasswordResetHash,
  findByEmailVerificationHash, emailExists, countActiveOwners, create, updateFields,
  updateAdmin, incrementSessionVersion, resetPassword, confirmEmail, consumeRecoveryCode, remove
};
