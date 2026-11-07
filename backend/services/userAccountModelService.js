// Account normalization, validation and safe presentation. No state or I/O on import.
function createUserAccountModelService(deps) {
  const { slugify, phoneDigits, cpfDigits, hashPassword, expandAdminPermissions, adminRoles, roleAlias, passwordPolicyError, effectiveAdminPermissions } = deps;

  function normalizeUser(input, existing = {}) {
    const name = String(input.name || existing.name || "Usuario").trim().slice(0, 120);
    const email = String(input.email || existing.email || "").trim().toLowerCase().slice(0, 160);
    const rawRole = input.role || existing.role || "customer";
    const role = rawRole === "editor" ? "manager" : rawRole;
    return {
      id: String(input.id || existing.id || slugify(email || name) || `usuario-${Date.now()}`),
      name,
      email,
      phone: input.phone !== undefined ? phoneDigits(input.phone) : existing.phone || "",
      cpf: input.cpf !== undefined ? cpfDigits(input.cpf) : existing.cpf || "",
      passwordHash: input.password ? hashPassword(String(input.password)) : input.passwordHash || existing.passwordHash || "",
      authProvider: input.authProvider || existing.authProvider || (input.googleSub || existing.googleSub ? "google" : "email"),
      googleSub: String(input.googleSub || existing.googleSub || "").slice(0, 255),
      picture: String(input.picture ?? existing.picture ?? "").slice(0, 2048),
      emailVerified: input.emailVerified !== undefined ? Boolean(input.emailVerified) : Boolean(existing.emailVerified),
      pendingEmail: input.pendingEmail !== undefined ? String(input.pendingEmail || "").trim().toLowerCase() : existing.pendingEmail || "",
      emailVerificationHash: input.emailVerificationHash !== undefined ? input.emailVerificationHash : existing.emailVerificationHash || "",
      emailVerificationExpiresAt: input.emailVerificationExpiresAt !== undefined ? input.emailVerificationExpiresAt : existing.emailVerificationExpiresAt || "",
      emailVerificationRequestedAt: input.emailVerificationRequestedAt !== undefined ? input.emailVerificationRequestedAt : existing.emailVerificationRequestedAt || "",
      passwordResetHash: input.passwordResetHash !== undefined ? input.passwordResetHash : existing.passwordResetHash || "",
      passwordResetExpiresAt: input.passwordResetExpiresAt !== undefined ? input.passwordResetExpiresAt : existing.passwordResetExpiresAt || "",
      passwordResetRequestedAt: input.passwordResetRequestedAt !== undefined ? input.passwordResetRequestedAt : existing.passwordResetRequestedAt || "",
      emailUnsubscribedAt: input.emailUnsubscribedAt !== undefined ? input.emailUnsubscribedAt : existing.emailUnsubscribedAt || "",
      emailUnsubscribeToken: input.emailUnsubscribeToken !== undefined ? input.emailUnsubscribeToken : existing.emailUnsubscribeToken || "",
      twoFactorEnabled: input.twoFactorEnabled !== undefined ? Boolean(input.twoFactorEnabled) : Boolean(existing.twoFactorEnabled),
      twoFactorSecret: input.twoFactorSecret !== undefined ? input.twoFactorSecret : existing.twoFactorSecret || "",
      twoFactorPendingSecret: input.twoFactorPendingSecret !== undefined ? input.twoFactorPendingSecret : existing.twoFactorPendingSecret || "",
      twoFactorRecoveryCodes: input.twoFactorRecoveryCodes !== undefined ? (Array.isArray(input.twoFactorRecoveryCodes) ? input.twoFactorRecoveryCodes : []) : existing.twoFactorRecoveryCodes || [],
      twoFactorConfirmedAt: input.twoFactorConfirmedAt !== undefined ? input.twoFactorConfirmedAt : existing.twoFactorConfirmedAt || "",
      twoFactorUpdatedAt: input.twoFactorUpdatedAt !== undefined ? input.twoFactorUpdatedAt : existing.twoFactorUpdatedAt || "",
      useCustomPermissions: role === "owner" ? false : input.useCustomPermissions !== undefined ? Boolean(input.useCustomPermissions) : Boolean(existing.useCustomPermissions),
      adminPermissions: input.adminPermissions !== undefined
        ? expandAdminPermissions(input.adminPermissions)
        : Array.isArray(existing.adminPermissions) ? existing.adminPermissions : [],
      sessionVersion: Number(existing.sessionVersion || 0),
      role: ["owner", "master", "manager", "operator", "seller", "customer"].includes(role) ? role : "customer",
      active: input.active !== undefined ? Boolean(input.active) : existing.active !== false,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || input.createdAt || new Date().toISOString()
    };
  }

  function adminProfilePicture(value) {
    const picture = String(value || "").trim();
    if (picture && !/^\/uploads\/profiles\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/.test(picture)) {
      throw Object.assign(new Error("Envie uma foto JPG, PNG ou WebP pelo painel."), { statusCode: 422, code: "USER_PICTURE_INVALID" });
    }
    return picture;
  }

  function adminUserPayload(input = {}, existing = {}) {
    const email = String(input.email ?? existing.email ?? "").trim().toLowerCase();
    const name = String(input.name ?? existing.name ?? "").trim();
    const password = input.password === undefined ? "" : String(input.password || "");
    const existingAccountType = existing.id && adminRoles().has(roleAlias(existing.role)) ? "team" : "customer";
    const requestedAccountType = input.accountType === "team" ? "team" : "customer";
    const accountType = existing.id ? existingAccountType : requestedAccountType;
    if (existing.id && input.accountType && requestedAccountType !== existingAccountType) {
      throw Object.assign(new Error("O tipo da conta não pode ser alterado por este formulário. Use a área correta de Contas."), { statusCode: 409, code: "USER_ACCOUNT_TYPE_MISMATCH" });
    }
    const requestedRole = roleAlias(input.role || existing.role || "operator");
    const role = accountType === "team" && ["owner", "manager", "operator"].includes(requestedRole)
      ? requestedRole
      : accountType === "team" ? "operator" : "customer";
    if (name.length < 2 || name.length > 120) {
      throw Object.assign(new Error("Informe o nome com 2 a 120 caracteres."), { statusCode: 422, code: "USER_NAME_INVALID" });
    }
    if (accountType === "customer" && (!existing.id || name !== existing.name) && name.split(/\s+/).length < 2) {
      throw Object.assign(new Error("Informe nome e sobrenome para a conta de cliente."), { statusCode: 422, code: "USER_NAME_INVALID" });
    }
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw Object.assign(new Error("Informe um e-mail válido."), { statusCode: 422, code: "USER_EMAIL_INVALID" });
    }
    if (password && passwordPolicyError(password)) {
      throw Object.assign(new Error(passwordPolicyError(password)), { statusCode: 422, code: "USER_PASSWORD_INVALID" });
    }
    if (accountType === "team" && !existing.id && !password) {
      throw Object.assign(new Error("Defina uma senha para a nova conta da equipe."), { statusCode: 422, code: "USER_PASSWORD_REQUIRED" });
    }
    return {
      id: existing.id || input.id,
      name,
      email,
      phone: input.phone,
      cpf: input.cpf,
      ...(accountType === "team" && input.picture !== undefined ? { picture: adminProfilePicture(input.picture) } : {}),
      ...(password ? { password } : {}),
      role,
      active: input.active,
      useCustomPermissions: accountType === "team" ? input.useCustomPermissions : false,
      adminPermissions: accountType === "team" ? input.adminPermissions : []
    };
  }

  function sanitizeUser(user) {
    if (!user) return null;
    const {
      passwordHash,
      passwordResetHash,
      passwordResetExpiresAt,
      passwordResetRequestedAt,
      emailVerificationHash,
      emailUnsubscribeToken,
      twoFactorSecret,
      twoFactorPendingSecret,
      twoFactorRecoveryCodes,
      sessionVersion,
      ...safeUser
    } = user;
    return {
      ...safeUser,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      twoFactorSetupPending: Boolean(user.twoFactorPendingSecret),
      twoFactorRecoveryCodesRemaining: Array.isArray(user.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes.length : 0,
      useCustomPermissions: Boolean(user.useCustomPermissions),
      adminPermissions: expandAdminPermissions(user.adminPermissions),
      effectivePermissions: effectiveAdminPermissions(user),
      twoFactorSetupRequired: Boolean(user.twoFactorSetupRequired)
    };
  }

  return { normalizeUser, adminProfilePicture, adminUserPayload, sanitizeUser };
}

module.exports = { createUserAccountModelService };
