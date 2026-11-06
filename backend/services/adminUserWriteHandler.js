function createAdminUserWriteHandler({ roleAlias, normalizeUser, adminUserPayload, postgresEnabled, userRepository, repositoryAudit, writeDb, sanitizeUser, readBody, sendJson }) {
  return async function handleAdminUserWriteRoutes({ req, res, pathname, method, db }) {
  if (pathname === "/api/users" && method === "POST") {
    const body = await readBody(req);
    if (roleAlias(body.role) === "owner" && roleAlias(req.adminUser?.role) !== "owner") {
      sendJson(res, 403, { error: { code: "OWNER_ROLE_PROTECTED", message: "Somente o dono pode criar outra conta de dono." } });
      return true;
    }
    const user = normalizeUser(adminUserPayload(body));
    if (postgresEnabled() ? await userRepository.emailExists(user.email) : db.users.some((existing) => existing.email === user.email)) {
      sendJson(res, 409, { error: { code: "USER_EMAIL_IN_USE", message: "Já existe um usuário com este e-mail." } });
      return true;
    }
    db.users = db.users.filter((existing) => existing.id !== user.id);
    db.users.push(user);
    const saved = postgresEnabled()
      ? await userRepository.create(user, { audit: repositoryAudit(req, "user", user.id, null, sanitizeUser(user)) })
      : (await writeDb(db), user);
    sendJson(res, 201, sanitizeUser(saved));
    return true;
  }


  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && method === "PUT") {
    const id = decodeURIComponent(userMatch[1]);
    const index = db.users.findIndex((item) => item.id === id);
    const repositoryUser = postgresEnabled() ? await userRepository.findById(id) : null;
    if (index === -1 && !repositoryUser) {
      sendJson(res, 404, { error: "Usuario nao encontrado" });
      return true;
    }

      const body = await readBody(req);
      const existingUser = repositoryUser || db.users[index];
      if (roleAlias(req.adminUser?.role) !== "owner" && roleAlias(existingUser?.role) === "owner") {
        sendJson(res, 403, { error: { code: "OWNER_ROLE_PROTECTED", message: "Somente o dono pode excluir outra conta de dono." } });
        return true;
      }
      if (!existingUser) {
        sendJson(res, 404, { error: "Usuario nao encontrado" });
        return true;
      }
      const nextRole = roleAlias(body.role || existingUser.role);
      if (roleAlias(req.adminUser?.role) !== "owner" && (roleAlias(existingUser.role) === "owner" || nextRole === "owner")) {
        sendJson(res, 403, { error: { code: "OWNER_ROLE_PROTECTED", message: "Somente o dono pode alterar contas com acesso de dono." } });
        return true;
      }
      const activeOwnerCount = postgresEnabled()
        ? await userRepository.countActiveOwners()
        : db.users.filter((candidate) => roleAlias(candidate.role) === "owner" && candidate.active !== false).length;
      if (roleAlias(existingUser.role) === "owner" && existingUser.active !== false && (nextRole !== "owner" || body.active === false) && activeOwnerCount <= 1) {
        sendJson(res, 409, { error: { code: "LAST_OWNER_REQUIRED", message: "Mantenha ao menos uma conta de dono ativa no painel." } });
        return true;
      }
      const user = normalizeUser(adminUserPayload(body, existingUser), existingUser);
      if (postgresEnabled() ? await userRepository.emailExists(user.email, id) : db.users.some((existing, existingIndex) => existingIndex !== index && existing.email === user.email)) {
        sendJson(res, 409, { error: { code: "USER_EMAIL_IN_USE", message: "Já existe um usuário com este e-mail." } });
        return true;
      }
      const accessChanged = user.role !== existingUser.role
        || user.active !== existingUser.active
        || user.useCustomPermissions !== existingUser.useCustomPermissions
        || JSON.stringify(user.adminPermissions || []) !== JSON.stringify(existingUser.adminPermissions || [])
        || Boolean(body.password);
      if (accessChanged) user.sessionVersion = Number(existingUser.sessionVersion || 0) + 1;
      if (index >= 0) db.users[index] = user;
      const saved = postgresEnabled()
        ? await userRepository.updateAdmin(user, {
          incrementSessionVersion: accessChanged,
          protectLastOwner: true,
          audit: repositoryAudit(req, "user", id, sanitizeUser(existingUser), sanitizeUser(user))
        })
        : (await writeDb(db), user);
      sendJson(res, 200, sanitizeUser(saved));
      return true;
  }
  return false;
  };
}

module.exports = { createAdminUserWriteHandler };
