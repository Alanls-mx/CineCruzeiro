// adminAccount routes, mounted at their original dispatcher position.
// Authentication and request-wide guards remain in server.js.
function createAdminAccountRoutes(deps) {
  const {
    crypto,
    readBody,
    storageService,
    sendJson,
    adminProfilePicture,
    repositoryAudit,
    postgresEnabled,
    userRepository,
    withCriticalMutation,
    readDb,
    getAdminUser,
    writeDb,
    sanitizeUser,
    passwordPolicyError,
    verifyPassword,
    hashPassword,
    verifySignedValue,
    parseCookies,
    signedValue,
    adminCookie,
    adminTwoFactorService,
    QRCode,
    logEvent,
    settingsRepository
  } = deps;

  return async function handleAdminAccountRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/profile/photo" && method === "POST") {
    const body = await readBody(req);
    const uploaded = await storageService.uploadImage({ data: body.data, filename: "perfil", contentType: body.contentType, folder: "profiles" });
    sendJson(res, 201, { url: uploaded.url });
    return true;
  }

  if (pathname === "/api/admin/me" && method === "PATCH") {
    const body = await readBody(req);
    const name = String(body.name ?? req.adminUser.name).trim();
    if (name.length < 2 || name.length > 120) {
      sendJson(res, 422, { error: { code: "USER_NAME_INVALID", message: "Informe um nome com 2 a 120 caracteres." } });
      return true;
    }
    const fields = { name, ...(body.picture !== undefined ? { picture: adminProfilePicture(body.picture) } : {}) };
    const audit = repositoryAudit(req, "user_profile", req.adminUser.id, null, fields);
    let user;
    if (postgresEnabled()) {
      user = await userRepository.updateFields(req.adminUser.id, fields, { audit });
    } else {
      await withCriticalMutation(async () => {
        const currentDb = await readDb();
        user = getAdminUser(req, currentDb);
        if (!user) return;
        const stored = currentDb.users.find((item) => item.id === user.id);
        Object.assign(stored, fields, { updatedAt: new Date().toISOString() });
        user = stored;
        currentDb.auditLogs ||= [];
        currentDb.auditLogs.push({ ...audit, id: `audit-${crypto.randomUUID()}`, userEmail: user.email, createdAt: new Date().toISOString() });
        await writeDb(currentDb);
      });
    }
    sendJson(res, user ? 200 : 401, user ? { user: sanitizeUser(user) } : { error: { message: "Entre novamente no painel." } });
    return true;
  }

  if (pathname === "/api/admin/me/password" && method === "POST") {
    const body = await readBody(req);
    const newPassword = String(body.newPassword || "");
    const policyError = passwordPolicyError(newPassword);
    if (policyError || newPassword !== body.confirmPassword) {
      sendJson(res, 422, { error: { code: "USER_PASSWORD_INVALID", message: policyError || "A confirmação da senha não confere." } });
      return true;
    }
    const current = postgresEnabled() ? await userRepository.findById(req.adminUser.id) : req.adminUser;
    if (!verifyPassword(String(body.currentPassword || ""), current?.passwordHash)) {
      sendJson(res, 422, { error: { code: "CURRENT_PASSWORD_INVALID", message: "A senha atual não confere." } });
      return true;
    }
    const passwordHash = hashPassword(newPassword);
    const audit = repositoryAudit(req, "user_security", current.id, null, { passwordChanged: true, otherSessionsRevoked: true });
    let updated;
    if (postgresEnabled()) {
      updated = await userRepository.changeOwnPassword(current.id, current.passwordHash, passwordHash, { audit });
    } else {
      await withCriticalMutation(async () => {
        const currentDb = await readDb();
        const user = currentDb.users.find((item) => item.id === current.id);
        if (!getAdminUser(req, currentDb) || user?.passwordHash !== current.passwordHash) return;
        Object.assign(user, { passwordHash, sessionVersion: Number(user.sessionVersion || 0) + 1, passwordResetHash: "", passwordResetExpiresAt: "", passwordResetRequestedAt: "", updatedAt: new Date().toISOString() });
        currentDb.auditLogs ||= [];
        currentDb.auditLogs.push({ ...audit, id: `audit-${crypto.randomUUID()}`, userEmail: user.email, createdAt: new Date().toISOString() });
        await writeDb(currentDb);
        updated = user;
      });
    }
    if (!updated) {
      sendJson(res, 409, { error: { message: "A conta foi alterada em outra sessão. Entre novamente." } });
      return true;
    }
    const previousSession = verifySignedValue(parseCookies(req).cine_admin);
    const session = signedValue({ ...previousSession, sv: updated.sessionVersion });
    const maxAge = Math.max(1, Math.floor((previousSession.exp - Date.now()) / 1000));
    sendJson(res, 200, { user: sanitizeUser(updated) }, { "Set-Cookie": adminCookie(session, maxAge), "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/2fa/status" && method === "GET") {
    const user = postgresEnabled() ? await userRepository.findById(req.adminUser.id) : (db.users || []).find((item) => item.id === req.adminUser.id);
    sendJson(res, 200, {
      enabled: Boolean(user?.twoFactorEnabled),
      configurationReady: adminTwoFactorService.encryptionConfigured(),
      setupPending: Boolean(user?.twoFactorPendingSecret),
      confirmedAt: user?.twoFactorConfirmedAt || "",
      recoveryCodesRemaining: Array.isArray(user?.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes.length : 0,
      requiredByPolicy: db.settings?.adminTwoFactorRequired !== false,
      serverTime: new Date().toISOString()
    });
    return true;
  }

  if (pathname === "/api/admin/2fa/setup" && method === "POST") {
    if (!adminTwoFactorService.encryptionConfigured()) {
      sendJson(res, 503, { error: { code: "ADMIN_2FA_SECRET_KEY_REQUIRED", message: "O servidor ainda não possui a chave de segurança do 2FA. Configure TWO_FACTOR_SECRET_KEY e tente novamente." } });
      return true;
    }
    const body = await readBody(req);
    const password = String(body.password || "");
    let secret = "";
    let accountEmail = "";
    const setupTwoFactor = async (lockedDb, direct = false) => {
      const user = direct ? await userRepository.findById(req.adminUser.id) : (lockedDb.users || []).find((item) => item.id === req.adminUser.id);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw Object.assign(new Error("Informe sua senha atual para configurar o 2FA."), { statusCode: 422, code: "ADMIN_2FA_PASSWORD_INVALID" });
      }
      if (user.twoFactorEnabled) {
        throw Object.assign(new Error("O 2FA ja esta ativo nesta conta."), { statusCode: 409, code: "ADMIN_2FA_ALREADY_ENABLED" });
      }
      secret = adminTwoFactorService.generateSecret();
      accountEmail = user.email;
      user.twoFactorPendingSecret = adminTwoFactorService.encryptSecret(secret);
      user.twoFactorUpdatedAt = new Date().toISOString();
      if (direct) await userRepository.updateFields(user.id, {
        twoFactorPendingSecret: user.twoFactorPendingSecret,
        twoFactorUpdatedAt: user.twoFactorUpdatedAt
      }, { event: "repository.user.two_factor_setup", operation: "twoFactorSetup" });
      else await writeDb(lockedDb);
    };
    if (postgresEnabled()) await setupTwoFactor(db, true);
    else await withCriticalMutation(async () => setupTwoFactor(await readDb(), false));
    const provisioningUri = adminTwoFactorService.otpauthUrl(secret, accountEmail);
    const qrCodeDataUrl = await QRCode.toDataURL(provisioningUri, {
      width: 280,
      margin: 2,
      color: { dark: "#07101f", light: "#ffffff" },
      errorCorrectionLevel: "M"
    });
    sendJson(res, 200, { qrCodeDataUrl, secret, provisioningUri });
    logEvent("info", "admin_two_factor.setup_started", { actorUserId: req.adminUser.id });
    return true;
  }

  if (pathname === "/api/admin/2fa/enable" && method === "POST") {
    const body = await readBody(req);
    const code = String(body.code || "");
    let recoveryCodes = [];
    const enableTwoFactor = async (lockedDb, direct = false) => {
      const user = direct ? await userRepository.findById(req.adminUser.id) : (lockedDb.users || []).find((item) => item.id === req.adminUser.id);
      const secret = adminTwoFactorService.decryptSecret(user?.twoFactorPendingSecret);
      if (!user || !secret) {
        throw Object.assign(new Error("Inicie a configuracao do 2FA antes de confirmar."), { statusCode: 409, code: "ADMIN_2FA_SETUP_REQUIRED" });
      }
      if (!adminTwoFactorService.verifyTotp(secret, code)) {
        throw Object.assign(new Error("O codigo nao confere. Aguarde um novo codigo no autenticador e tente novamente."), { statusCode: 422, code: "ADMIN_2FA_INVALID" });
      }
      recoveryCodes = adminTwoFactorService.generateRecoveryCodes();
      user.twoFactorEnabled = true;
      user.twoFactorSecret = user.twoFactorPendingSecret;
      user.twoFactorPendingSecret = "";
      user.twoFactorRecoveryCodes = recoveryCodes.map(adminTwoFactorService.hashRecoveryCode);
      user.twoFactorConfirmedAt = new Date().toISOString();
      user.twoFactorUpdatedAt = user.twoFactorConfirmedAt;
      if (direct) await userRepository.updateFields(user.id, {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorPendingSecret: "",
        twoFactorRecoveryCodes: user.twoFactorRecoveryCodes,
        twoFactorConfirmedAt: user.twoFactorConfirmedAt,
        twoFactorUpdatedAt: user.twoFactorUpdatedAt
      }, { event: "repository.user.two_factor_enable", operation: "twoFactorEnable" });
      else await writeDb(lockedDb);
    };
    if (postgresEnabled()) await enableTwoFactor(db, true);
    else await withCriticalMutation(async () => enableTwoFactor(await readDb(), false));
    sendJson(res, 200, {
      enabled: true,
      recoveryCodes,
      message: "Autenticacao em duas etapas ativada. Guarde os codigos de recuperacao agora."
    });
    logEvent("info", "admin_two_factor.enabled", { actorUserId: req.adminUser.id });
    return true;
  }

  if (pathname === "/api/admin/2fa/disable" && method === "POST") {
    if (db.settings?.adminTwoFactorRequired !== false) {
      sendJson(res, 409, { error: { code: "ADMIN_2FA_REQUIRED_BY_POLICY", message: "O 2FA é obrigatório para todas as contas do painel. Desative primeiro a exigência global em Contas." } });
      return true;
    }
    const body = await readBody(req);
    const disableTwoFactor = async (lockedDb, direct = false) => {
      const user = direct ? await userRepository.findById(req.adminUser.id) : (lockedDb.users || []).find((item) => item.id === req.adminUser.id);
      const secret = adminTwoFactorService.decryptSecret(user?.twoFactorSecret);
      const passwordValid = user && verifyPassword(String(body.password || ""), user.passwordHash);
      const code = String(body.code || "");
      const codeValid = secret && (adminTwoFactorService.verifyTotp(secret, code) || adminTwoFactorService.recoveryCodeIndex(user.twoFactorRecoveryCodes, code) >= 0);
      if (!passwordValid || !codeValid) {
        throw Object.assign(new Error("Senha ou codigo de verificacao invalido."), { statusCode: 422, code: "ADMIN_2FA_DISABLE_INVALID" });
      }
      user.twoFactorEnabled = false;
      user.twoFactorSecret = "";
      user.twoFactorPendingSecret = "";
      user.twoFactorRecoveryCodes = [];
      user.twoFactorConfirmedAt = "";
      user.twoFactorUpdatedAt = new Date().toISOString();
      if (direct) await userRepository.updateFields(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: "",
        twoFactorPendingSecret: "",
        twoFactorRecoveryCodes: [],
        twoFactorConfirmedAt: "",
        twoFactorUpdatedAt: user.twoFactorUpdatedAt
      }, { event: "repository.user.two_factor_disable", operation: "twoFactorDisable" });
      else await writeDb(lockedDb);
    };
    if (postgresEnabled()) await disableTwoFactor(db, true);
    else await withCriticalMutation(async () => disableTwoFactor(await readDb(), false));
    sendJson(res, 200, { enabled: false, message: "Autenticacao em duas etapas desativada." });
    logEvent("info", "admin_two_factor.disabled", { actorUserId: req.adminUser.id });
    return true;
  }

  if (pathname === "/api/admin/security-policy" && method === "GET") {
    sendJson(res, 200, { adminTwoFactorRequired: db.settings?.adminTwoFactorRequired !== false });
    return true;
  }

  if (pathname === "/api/admin/security-policy" && method === "PUT") {
    const body = await readBody(req);
    db.settings.adminTwoFactorRequired = Boolean(body.adminTwoFactorRequired);
    if (postgresEnabled()) {
      await settingsRepository.patchAppSettings({ adminTwoFactorRequired: db.settings.adminTwoFactorRequired }, {
        audit: repositoryAudit(req, "settings", "adminTwoFactorRequired", null, { adminTwoFactorRequired: db.settings.adminTwoFactorRequired })
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { adminTwoFactorRequired: db.settings.adminTwoFactorRequired });
    logEvent("info", "admin_two_factor.policy_updated", {
      actorUserId: req.adminUser.id,
      required: db.settings.adminTwoFactorRequired
    });
    return true;
  }

  if (pathname === "/api/admin/2fa/recovery-codes" && method === "POST") {
    const body = await readBody(req);
    let recoveryCodes = [];
    const regenerateRecoveryCodes = async (lockedDb, direct = false) => {
      const user = direct ? await userRepository.findById(req.adminUser.id) : (lockedDb.users || []).find((item) => item.id === req.adminUser.id);
      const secret = adminTwoFactorService.decryptSecret(user?.twoFactorSecret);
      if (!user || !user.twoFactorEnabled || !verifyPassword(String(body.password || ""), user.passwordHash) || !adminTwoFactorService.verifyTotp(secret, String(body.code || ""))) {
        throw Object.assign(new Error("Confirme sua senha e o codigo atual do autenticador."), { statusCode: 422, code: "ADMIN_2FA_RECOVERY_REGEN_INVALID" });
      }
      recoveryCodes = adminTwoFactorService.generateRecoveryCodes();
      user.twoFactorRecoveryCodes = recoveryCodes.map(adminTwoFactorService.hashRecoveryCode);
      user.twoFactorUpdatedAt = new Date().toISOString();
      if (direct) await userRepository.updateFields(user.id, {
        twoFactorRecoveryCodes: user.twoFactorRecoveryCodes,
        twoFactorUpdatedAt: user.twoFactorUpdatedAt
      }, { event: "repository.user.recovery_codes", operation: "recoveryCodes" });
      else await writeDb(lockedDb);
    };
    if (postgresEnabled()) await regenerateRecoveryCodes(db, true);
    else await withCriticalMutation(async () => regenerateRecoveryCodes(await readDb(), false));
    sendJson(res, 200, { recoveryCodes, message: "Novos codigos gerados. Os anteriores deixaram de funcionar." });
    logEvent("info", "admin_two_factor.recovery_codes_regenerated", { actorUserId: req.adminUser.id });
    return true;
  }
    return false;
  };
}

module.exports = { createAdminAccountRoutes };
