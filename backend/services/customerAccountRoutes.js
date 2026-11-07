// customerAccount routes, mounted at their original dispatcher position.
// Authentication and request-wide guards remain in server.js.
function createCustomerAccountRoutes(deps) {
  const {
    crypto,
    readBody,
    sendJson,
    getCustomerUser,
    phoneDigits,
    cpfDigits,
    verifyPassword,
    passwordPolicyError,
    hashPassword,
    postgresEnabled,
    userRepository,
    writeDb,
    sanitizeUser,
    customerCookie,
    customerSessionValue,
    requestStillCoolingDown,
    getGoogleOAuthConfig,
    hashResetToken,
    notifyEmailVerification,
    isProduction,
    transactionalEmailConfigured,
    authResponse
  } = deps;

  return async function handleCustomerAccountRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/me" && method === "PATCH") {
    let user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return true;
    }
    const body = await readBody(req);
    const requestedEmail = String(body.email || "").trim().toLowerCase();
    const requestedName = String(body.name ?? user.name ?? "").trim();
    if (requestedName.length < 2 || requestedName.length > 120) {
      sendJson(res, 422, { error: { code: "CUSTOMER_NAME_INVALID", message: "Informe seu nome com 2 a 120 caracteres." } });
      return true;
    }
    if (body.name !== undefined && requestedName !== user.name && requestedName.split(/\s+/).length < 2) {
      sendJson(res, 422, { error: { code: "CUSTOMER_NAME_INVALID", message: "Informe nome e sobrenome no seu perfil." } });
      return true;
    }
    if (requestedEmail && (requestedEmail.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail))) {
      sendJson(res, 422, { error: { code: "CUSTOMER_EMAIL_INVALID", message: "Informe um e-mail válido." } });
      return true;
    }
    if (requestedEmail && requestedEmail !== user.email) {
      sendJson(res, 400, { error: { code: "EMAIL_CHANGE_REQUIRES_VERIFICATION", message: "Use o fluxo de verificacao para trocar o e-mail." } });
      return true;
    }
    const nextPhone = body.phone !== undefined ? phoneDigits(body.phone) : user.phone || "";
    const nextCpf = body.cpf !== undefined ? cpfDigits(body.cpf) : user.cpf || "";
    user.name = requestedName;
    user.phone = nextPhone;
    user.cpf = nextCpf;
    const wantsPasswordChange = body.password !== undefined || body.newPassword !== undefined || body.currentPassword !== undefined || body.confirmPassword !== undefined;
    let passwordChanged = false;
    if (wantsPasswordChange) {
      const currentPassword = String(body.currentPassword || "");
      const nextPassword = String(body.newPassword ?? body.password ?? "");
      const confirmPassword = String(body.confirmPassword ?? body.newPassword ?? body.password ?? "");
      if (!nextPassword && !currentPassword && !confirmPassword) {
        // No-op for clients that submit empty password fields.
      } else if (!user.passwordHash) {
        sendJson(res, 400, { error: { code: "PASSWORD_CHANGE_OAUTH", message: "Esta conta usa login Google. Use recuperação de senha para criar uma senha." } });
        return true;
      } else if (!currentPassword) {
        sendJson(res, 400, { error: { code: "CURRENT_PASSWORD_REQUIRED", message: "Informe sua senha atual para trocar a senha." } });
        return true;
      } else if (!verifyPassword(currentPassword, user.passwordHash)) {
        sendJson(res, 401, { error: { code: "CURRENT_PASSWORD_INVALID", message: "A senha atual está incorreta." } });
        return true;
      } else if (nextPassword !== confirmPassword) {
        sendJson(res, 400, { error: { code: "PASSWORD_CONFIRMATION_MISMATCH", message: "As novas senhas não coincidem." } });
        return true;
      } else if (passwordPolicyError(nextPassword)) {
        sendJson(res, 400, { error: { code: "PASSWORD_LENGTH_INVALID", message: passwordPolicyError(nextPassword) } });
        return true;
      } else {
        user.passwordHash = hashPassword(nextPassword);
        user.sessionVersion = Number(user.sessionVersion || 0) + 1;
        user.authProvider = user.authProvider || "email";
        passwordChanged = true;
      }
    }
    user.updatedAt = new Date().toISOString();
    if (postgresEnabled()) {
      const fields = { name: user.name, phone: user.phone, cpf: user.cpf };
      if (passwordChanged) {
        Object.assign(fields, { passwordHash: user.passwordHash, authProvider: user.authProvider });
      }
      user = await userRepository.updateFields(user.id, fields, {
        event: "repository.user.profile_update", operation: "profileUpdate", incrementSessionVersion: passwordChanged
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { user: sanitizeUser(user) }, {
      "Set-Cookie": customerCookie(customerSessionValue(user))
    });
    return true;
  }

  if (pathname === "/api/me/email-change/request" && method === "POST") {
    let user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return true;
    }
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { error: { code: "EMAIL_INVALID", message: "Informe um e-mail valido." } });
      return true;
    }
    if (postgresEnabled() ? await userRepository.emailExists(email, user.id) : (db.users || []).some((item) => item.id !== user.id && item.email === email && item.active !== false)) {
      sendJson(res, 409, { error: { code: "EMAIL_IN_USE", message: "Ja existe uma conta com este e-mail." } });
      return true;
    }
    if (user.pendingEmail === email && requestStillCoolingDown(user.emailVerificationRequestedAt)) {
      sendJson(res, 429, { error: { code: "EMAIL_VERIFICATION_COOLDOWN", message: "Aguarde alguns minutos antes de pedir um novo e-mail de verificação." } });
      return true;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(token)}`;
    user.pendingEmail = email;
    user.emailVerificationHash = hashResetToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    if (postgresEnabled()) user = await userRepository.updateFields(user.id, {
      pendingEmail: user.pendingEmail,
      emailVerificationHash: user.emailVerificationHash,
      emailVerificationExpiresAt: user.emailVerificationExpiresAt,
      emailVerificationRequestedAt: user.emailVerificationRequestedAt
    }, { event: "repository.user.email_change_request", operation: "emailChangeRequest" });
    else await writeDb(db);
    const delivered = await notifyEmailVerification(email, verificationUrl, db);
    if (isProduction() && !delivered) {
      user.pendingEmail = "";
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      if (postgresEnabled()) user = await userRepository.updateFields(user.id, {
        pendingEmail: "", emailVerificationHash: "", emailVerificationExpiresAt: ""
      }, { event: "repository.user.email_change_cleanup", operation: "emailChangeCleanup" });
      else await writeDb(db);
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "Configure e ative SMTP ou webhook de e-mail para verificar troca de e-mail em produção." } });
      return true;
    }
    sendJson(res, 202, {
      ok: true,
      message: "Enviamos a verificacao para o novo e-mail.",
      user: sanitizeUser(user),
      ...(!isProduction() ? { verificationToken: token, verificationUrl } : {})
    });
    return true;
  }

  if (pathname === "/api/me/email-verification/request" && method === "POST") {
    let user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return true;
    }
    if (user.emailVerified) {
      sendJson(res, 200, { ok: true, message: "Seu e-mail já está confirmado.", user: sanitizeUser(user) });
      return true;
    }
    if (requestStillCoolingDown(user.emailVerificationRequestedAt)) {
      sendJson(res, 429, { error: { code: "EMAIL_VERIFICATION_COOLDOWN", message: "Aguarde alguns minutos antes de pedir um novo e-mail de confirmação." } });
      return true;
    }
    if (isProduction() && !transactionalEmailConfigured(db)) {
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "Configure e ative SMTP ou webhook de e-mail para confirmar contas em produção." } });
      return true;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(token)}`;
    user.pendingEmail = user.email;
    user.emailVerified = false;
    user.emailVerificationHash = hashResetToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    if (postgresEnabled()) user = await userRepository.updateFields(user.id, {
      pendingEmail: user.pendingEmail,
      emailVerified: false,
      emailVerificationHash: user.emailVerificationHash,
      emailVerificationExpiresAt: user.emailVerificationExpiresAt,
      emailVerificationRequestedAt: user.emailVerificationRequestedAt
    }, { event: "repository.user.email_verification_request", operation: "emailVerificationRequest" });
    else await writeDb(db);
    const delivered = await notifyEmailVerification(user.email, verificationUrl, db);
    if (isProduction() && !delivered) {
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      user.emailVerificationRequestedAt = "";
      user.pendingEmail = "";
      user.updatedAt = new Date().toISOString();
      if (postgresEnabled()) user = await userRepository.updateFields(user.id, {
        emailVerificationHash: "", emailVerificationExpiresAt: "", emailVerificationRequestedAt: "", pendingEmail: ""
      }, { event: "repository.user.email_verification_cleanup", operation: "emailVerificationCleanup" });
      else await writeDb(db);
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_FAILED", message: "Não foi possível enviar a confirmação agora. Confira a integração de e-mail." } });
      return true;
    }
    sendJson(res, 202, {
      ok: true,
      message: "Enviamos um link de confirmação para o e-mail da sua conta.",
      user: sanitizeUser(user),
      ...(!isProduction() ? { verificationToken: token, verificationUrl } : {})
    });
    return true;
  }

  if (["/api/auth/email/verify", "/api/me/email-change/confirm"].includes(pathname) && method === "POST") {
    const body = await readBody(req);
    const tokenHash = hashResetToken(body.token || "");
    let user = postgresEnabled()
      ? await userRepository.findByEmailVerificationHash(tokenHash)
      : (db.users || []).find((item) =>
        item.active !== false && item.emailVerificationHash === tokenHash
        && item.emailVerificationExpiresAt && new Date(item.emailVerificationExpiresAt).getTime() > Date.now()
      );
    if (!user || !user.pendingEmail) {
      sendJson(res, 400, { error: { code: "EMAIL_VERIFICATION_INVALID", message: "Token de verificacao invalido ou expirado." } });
      return true;
    }
    if (postgresEnabled() ? await userRepository.emailExists(user.pendingEmail, user.id) : (db.users || []).some((item) => item.id !== user.id && item.email === user.pendingEmail && item.active !== false)) {
      sendJson(res, 409, { error: { code: "EMAIL_IN_USE", message: "Ja existe uma conta com este e-mail." } });
      return true;
    }
    if (postgresEnabled()) {
      user = await userRepository.confirmEmail(user.id, tokenHash, user.pendingEmail);
      if (!user) {
        sendJson(res, 400, { error: { code: "EMAIL_VERIFICATION_INVALID", message: "Token de verificacao invalido ou expirado." } });
        return true;
      }
    } else {
      user.email = user.pendingEmail;
      user.pendingEmail = "";
      user.emailVerified = true;
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      user.emailVerificationRequestedAt = "";
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
    sendJson(res, 200, { ok: true, ...authResponse(user) }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return true;
  }
    return false;
  };
}

module.exports = { createCustomerAccountRoutes };
