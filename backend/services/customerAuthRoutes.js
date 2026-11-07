// customerAuth routes, mounted at their original dispatcher position.
// Authentication and request-wide guards remain in server.js.
function createCustomerAuthRoutes(deps) {
  const {
    crypto,
    readBody,
    sendJson,
    passwordPolicyError,
    postgresEnabled,
    userRepository,
    normalizeUser,
    hashPassword,
    getGoogleOAuthConfig,
    hashResetToken,
    writeDb,
    notifyEmailVerification,
    isProduction,
    authResponse,
    customerCookie,
    customerSessionValue,
    loginBlockStatus,
    recordLoginFailure,
    clearLoginFailures,
    passwordNeedsRehash,
    verifyPassword,
    getCustomerUser,
    sanitizeUser,
    checkoutAccessCookie,
    requestStillCoolingDown,
    transactionalEmailConfigured,
    logEvent,
    notifyPasswordReset
  } = deps;

  return async function handleCustomerAuthRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/auth/register" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const hasSeparateName = Object.hasOwn(body, "firstName") || Object.hasOwn(body, "lastName");
    const submittedName = String(body.name || "").trim().replace(/\s+/g, " ");
    const [legacyFirstName = "", ...legacyLastName] = submittedName.split(" ");
    const firstName = hasSeparateName ? String(body.firstName || "").trim().replace(/\s+/g, " ") : legacyFirstName;
    const lastName = hasSeparateName ? String(body.lastName || "").trim().replace(/\s+/g, " ") : legacyLastName.join(" ");
    const name = `${firstName} ${lastName}`.trim();
    if (firstName.length < 2 || !lastName || name.length > 120) {
      sendJson(res, 422, { error: { code: "CUSTOMER_NAME_INVALID", message: "Informe nome e sobrenome para criar sua conta." } });
      return true;
    }
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 422, { error: { code: "CUSTOMER_EMAIL_INVALID", message: "Informe um e-mail válido." } });
      return true;
    }
    const passwordError = passwordPolicyError(password);
    if (passwordError) {
      sendJson(res, 422, { error: { code: "CUSTOMER_PASSWORD_INVALID", message: passwordError } });
      return true;
    }
    if (postgresEnabled() ? await userRepository.emailExists(email) : db.users.some((item) => item.email === email)) {
      sendJson(res, 409, { error: "Ja existe uma conta com este e-mail." });
      return true;
    }

    let user = normalizeUser({
      name,
      email,
      phone: body.phone,
      cpf: body.cpf,
      passwordHash: hashPassword(password),
      role: "customer",
      active: true,
      authProvider: "email"
    });
    const verificationToken = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(verificationToken)}`;
    user.pendingEmail = email;
    user.emailVerified = false;
    user.emailVerificationHash = hashResetToken(verificationToken);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    db.users.push(user);
    user = postgresEnabled() ? await userRepository.create(user) : (await writeDb(db), user);
    const verificationEmailSent = await notifyEmailVerification(email, verificationUrl, db);
    if (isProduction() && !verificationEmailSent) {
      user.pendingEmail = "";
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      user.emailVerificationRequestedAt = "";
      user.updatedAt = new Date().toISOString();
      if (postgresEnabled()) {
        user = await userRepository.updateFields(user.id, {
          pendingEmail: "", emailVerificationHash: "", emailVerificationExpiresAt: "", emailVerificationRequestedAt: ""
        }, { event: "repository.user.email_verification_cleanup", operation: "emailVerificationCleanup" });
      } else {
        await writeDb(db);
      }
    }
    sendJson(res, 201, {
      ...authResponse(user),
      verificationEmailSent,
      message: verificationEmailSent
        ? "Conta criada. Enviamos um link para confirmar seu e-mail."
        : "Conta criada, mas não foi possível enviar a confirmação agora. Você pode solicitar um novo link em Minha Conta."
    }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return true;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const blocked = loginBlockStatus(req, "customer", email);
    if (blocked) {
      sendJson(res, 429, { error: { code: "CUSTOMER_LOGIN_BLOCKED", message: "Muitas tentativas. Aguarde antes de tentar novamente." } }, { "Retry-After": String(blocked.retryAfter) });
      return true;
    }
    let user = postgresEnabled() ? await userRepository.findByEmail(email) : db.users.find((item) => item.email === email);
    if (user?.active === false) user = null;
    if (!user) {
      recordLoginFailure(req, "customer", email);
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return true;
    }

    if (!user.passwordHash) {
      recordLoginFailure(req, "customer", email);
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return true;
    }

    if (!verifyPassword(String(body.password || ""), user.passwordHash)) {
      recordLoginFailure(req, "customer", email);
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return true;
    }

    clearLoginFailures(req, "customer", email);
    if (passwordNeedsRehash(user.passwordHash)) {
      user.passwordHash = hashPassword(String(body.password || ""));
      user.updatedAt = new Date().toISOString();
      user = postgresEnabled()
        ? await userRepository.updateFields(user.id, { passwordHash: user.passwordHash }, { event: "repository.user.password_rehash", operation: "passwordRehash" })
        : (await writeDb(db), user);
    }

    sendJson(res, 200, authResponse(user), { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return true;
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return true;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    let user = getCustomerUser(req, db);
    if (user) {
      if (postgresEnabled()) await userRepository.incrementSessionVersion(user.id);
      else {
        user.sessionVersion = Number(user.sessionVersion || 0) + 1;
        user.updatedAt = new Date().toISOString();
        await writeDb(db);
      }
    }
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": [customerCookie("", 0), checkoutAccessCookie(req, "", 0)]
    });
    return true;
  }

  if (pathname === "/api/auth/password/request" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    let user = email ? (postgresEnabled() ? await userRepository.findByEmail(email) : db.users.find((item) => item.email === email)) : null;
    if (user?.active === false || user?.authProvider === "google") user = null;
    let resetToken = "";
    let resetUrl = "";

    if (user) {
      if (requestStillCoolingDown(user.passwordResetRequestedAt)) {
        sendJson(res, 202, {
          ok: true,
          message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao."
        });
        return true;
      }
      if (isProduction() && !transactionalEmailConfigured(db)) {
        logEvent("warn", "password_reset.delivery_not_configured", { email });
        sendJson(res, 202, {
          ok: true,
          message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao."
        });
        return true;
      }
      resetToken = crypto.randomBytes(32).toString("base64url");
      resetUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?resetToken=${encodeURIComponent(resetToken)}`;
      user.passwordResetHash = hashResetToken(resetToken);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      user.passwordResetRequestedAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      if (postgresEnabled()) await userRepository.updateFields(user.id, {
        passwordResetHash: user.passwordResetHash,
        passwordResetExpiresAt: user.passwordResetExpiresAt,
        passwordResetRequestedAt: user.passwordResetRequestedAt
      }, { event: "repository.user.password_reset_request", operation: "passwordResetRequest" });
      else await writeDb(db);
      const delivered = await notifyPasswordReset(email, resetUrl, db);
      if (isProduction() && !delivered) {
        user.passwordResetHash = "";
        user.passwordResetExpiresAt = "";
        if (postgresEnabled()) await userRepository.updateFields(user.id, {
          passwordResetHash: "", passwordResetExpiresAt: ""
        }, { event: "repository.user.password_reset_cleanup", operation: "passwordResetCleanup" });
        else await writeDb(db);
      }
    }

    sendJson(res, 202, {
      ok: true,
      message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao.",
      ...(user && !isProduction() ? { resetToken, resetUrl } : {})
    });
    return true;
  }

  if (pathname === "/api/auth/password/reset" && method === "POST") {
    const body = await readBody(req);
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const passwordError = passwordPolicyError(password);
    if (!token || passwordError) {
      sendJson(res, 400, { error: { code: "PASSWORD_RESET_INVALID", message: passwordError || "Token de recuperação inválido." } });
      return true;
    }

    const tokenHash = hashResetToken(token);
    let user = postgresEnabled()
      ? await userRepository.findByPasswordResetHash(tokenHash)
      : db.users.find((item) =>
        item.active !== false && item.authProvider !== "google" && item.passwordResetHash === tokenHash
        && item.passwordResetExpiresAt && new Date(item.passwordResetExpiresAt).getTime() > Date.now()
      );
    if (!user) {
      sendJson(res, 400, { error: { code: "PASSWORD_RESET_EXPIRED", message: "Token de recuperacao invalido ou expirado." } });
      return true;
    }

    if (postgresEnabled()) {
      user = await userRepository.resetPassword(user.id, tokenHash, hashPassword(password), user.authProvider || "email");
      if (!user) {
        sendJson(res, 400, { error: { code: "PASSWORD_RESET_EXPIRED", message: "Token de recuperacao invalido ou expirado." } });
        return true;
      }
    } else {
      user.passwordHash = hashPassword(password);
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      user.authProvider = user.authProvider || "email";
      user.passwordResetHash = "";
      user.passwordResetExpiresAt = "";
      user.passwordResetRequestedAt = "";
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
    sendJson(res, 200, { ok: true, ...authResponse(user) }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return true;
  }
    return false;
  };
}

module.exports = { createCustomerAuthRoutes };
