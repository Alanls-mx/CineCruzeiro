// adminSession routes, mounted at their original dispatcher position.
// Authentication and request-wide guards remain in server.js.
function createAdminSessionRoutes(deps) {
  const {
    crypto,
    readBody,
    loginBlockStatus,
    sendJson,
    postgresEnabled,
    userRepository,
    adminRoles,
    verifyPassword,
    recordLoginFailure,
    clearLoginFailures,
    passwordNeedsRehash,
    hashPassword,
    writeDb,
    adminTwoFactorService,
    createAdminTwoFactorChallenge,
    readAdminTwoFactorChallenge,
    adminTwoFactorChallenges,
    withCriticalMutation,
    readDb,
    sendAdminLoginSuccess,
    getAdminUser,
    adminOriginAllowed,
    repositoryAudit,
    clientIp,
    securityHeaders,
    adminCookie,
    responseCorsOrigin,
    sanitizeUser
  } = deps;

  return async function handleAdminSessionRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/login" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const blocked = loginBlockStatus(req, "admin", email);
    if (blocked) {
      sendJson(res, 429, { error: { code: "ADMIN_LOGIN_BLOCKED", message: "Muitas tentativas. Aguarde antes de tentar novamente." } }, { "Retry-After": String(blocked.retryAfter) });
      return true;
    }
    let user = postgresEnabled()
      ? await userRepository.findByEmail(email)
      : (db.users || []).find((item) => item.email === email);
    if (user?.active === false || !adminRoles().has(user?.role)) user = null;
    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
      recordLoginFailure(req, "admin", email);
      sendJson(res, 401, { error: { code: "ADMIN_LOGIN_INVALID", message: "E-mail ou senha invalidos." } });
      return true;
    }
    clearLoginFailures(req, "admin", email);
    if (passwordNeedsRehash(user.passwordHash)) {
      user.passwordHash = hashPassword(String(body.password || ""));
      user.updatedAt = new Date().toISOString();
      user = postgresEnabled()
        ? await userRepository.updateFields(user.id, { passwordHash: user.passwordHash }, { event: "repository.user.password_rehash", operation: "passwordRehash" })
        : (await writeDb(db), user);
    }
    if (user.twoFactorEnabled) {
      const secret = adminTwoFactorService.decryptSecret(user.twoFactorSecret);
      if (!secret) {
        sendJson(res, 503, { error: { code: "ADMIN_2FA_CONFIGURATION_INVALID", message: "O 2FA desta conta precisa ser recuperado pelo administrador do sistema." } });
        return true;
      }
      sendJson(res, 202, {
        twoFactorRequired: true,
        challenge: createAdminTwoFactorChallenge(user.id),
        expiresIn: 300
      });
      return true;
    }
    await sendAdminLoginSuccess(req, res, db, user);
    return true;
  }

  if (pathname === "/api/admin/login/2fa" && method === "POST") {
    const body = await readBody(req);
    const challengeToken = String(body.challenge || "");
    const challenge = readAdminTwoFactorChallenge(challengeToken);
    if (!challenge) {
      sendJson(res, 401, { error: { code: "ADMIN_2FA_CHALLENGE_EXPIRED", message: "A verificacao expirou. Entre com e-mail e senha novamente." } });
      return true;
    }
    challenge.attempts += 1;
    const submittedCode = String(body.code || "").trim();
    let authenticatedUser = null;
    let authenticatedDb = db;
    let methodUsed = "totp";
    const authenticateTwoFactor = async (lockedDb, direct = false) => {
      const user = direct
        ? await userRepository.findById(challenge.userId)
        : (lockedDb.users || []).find((item) => item.id === challenge.userId);
      const secret = adminTwoFactorService.decryptSecret(user?.twoFactorSecret);
      if (!user || user.active === false || !adminRoles().has(user.role) || !user.twoFactorEnabled || !secret) return;
      let valid = adminTwoFactorService.verifyTotp(secret, submittedCode);
      if (!valid) {
        const recoveryIndex = adminTwoFactorService.recoveryCodeIndex(user.twoFactorRecoveryCodes, submittedCode);
        if (recoveryIndex >= 0) {
          const expectedCodes = [...user.twoFactorRecoveryCodes];
          user.twoFactorRecoveryCodes.splice(recoveryIndex, 1);
          user.twoFactorUpdatedAt = new Date().toISOString();
          if (direct) {
            const consumed = await userRepository.consumeRecoveryCode(user.id, expectedCodes, user.twoFactorRecoveryCodes);
            valid = Boolean(consumed);
            if (consumed) authenticatedUser = consumed;
          } else {
            valid = true;
            await writeDb(lockedDb);
          }
          if (valid) methodUsed = "recovery_code";
        }
      }
      if (!valid) return;
      authenticatedUser ||= user;
      authenticatedDb = lockedDb;
    };
    if (postgresEnabled()) await authenticateTwoFactor(db, true);
    else await withCriticalMutation(async () => authenticateTwoFactor(await readDb(), false));
    if (!authenticatedUser) {
      if (challenge.attempts >= 6) adminTwoFactorChallenges.delete(challengeToken);
      sendJson(res, 401, { error: { code: "ADMIN_2FA_INVALID", message: "Codigo invalido. Confira o autenticador ou use um codigo de recuperacao." } });
      return true;
    }
    challenge.used = true;
    adminTwoFactorChallenges.delete(challengeToken);
    await sendAdminLoginSuccess(req, res, authenticatedDb, authenticatedUser, methodUsed);
    return true;
  }

  if (pathname === "/api/admin/logout" && method === "POST") {
    const user = getAdminUser(req, db);
    if (user && !adminOriginAllowed(req)) {
      sendJson(res, 403, { error: { code: "ADMIN_CSRF_BLOCKED", message: "Origem da requisição administrativa não autorizada." } });
      return true;
    }
    if (user) {
      if (postgresEnabled()) {
        await userRepository.incrementSessionVersion(user.id, {
          audit: repositoryAudit(req, "admin_session", user.id, { active: true }, { active: false })
        });
      } else {
        const storedUser = (db.users || []).find((item) => item.id === user.id);
        if (storedUser) storedUser.sessionVersion = Number(storedUser.sessionVersion || 0) + 1;
        db.auditLogs ||= [];
        db.auditLogs.push({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          userId: user.id,
          userEmail: user.email,
          action: "POST /api/admin/logout",
          entityType: "admin_session",
          entityId: user.id,
          before: { active: true },
          after: { active: false },
          ip: clientIp(req),
          createdAt: new Date().toISOString()
        });
        await writeDb(db);
      }
    }
    res.writeHead(204, {
      ...securityHeaders(),
      "Set-Cookie": adminCookie("", 0),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    });
    res.end();
    return true;
  }

  if (pathname === "/api/admin/me" && method === "GET") {
    const user = getAdminUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para continuar." } });
      return true;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return true;
  }
    return false;
  };
}

module.exports = { createAdminSessionRoutes };
