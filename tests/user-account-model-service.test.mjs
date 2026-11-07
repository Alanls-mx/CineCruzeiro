import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createUserAccountModelService } = require('../backend/services/userAccountModelService.js');

const model = createUserAccountModelService({
  slugify: (value) => String(value).replace(/\W+/g, '-'),
  phoneDigits: (value) => String(value),
  cpfDigits: (value) => String(value),
  hashPassword: (value) => `hashed:${value}`,
  expandAdminPermissions: (permissions) => permissions || [],
  adminRoles: () => new Set(['owner', 'manager', 'operator']),
  roleAlias: (role) => role,
  passwordPolicyError: (password) => password.length < 10 ? 'Senha curta' : '',
  effectiveAdminPermissions: () => []
});

test('account model preserves normalization and strips session/security fields', () => {
  const user = model.normalizeUser({ name: 'Ana Silva', email: 'ANA@EXAMPLE.TEST', role: 'customer', password: 'Senha-forte-2026!' });
  assert.equal(user.email, 'ana@example.test');
  assert.equal(user.passwordHash, 'hashed:Senha-forte-2026!');
  const safe = model.sanitizeUser({ ...user, twoFactorSecret: 'secret', sessionVersion: 9, passwordResetHash: 'reset' });
  for (const key of ['passwordHash', 'twoFactorSecret', 'sessionVersion', 'passwordResetHash']) assert.equal(key in safe, false);
  assert.equal(safe.email, user.email);
});

test('account payload still enforces customer surname and keeps team roles separate', () => {
  assert.throws(() => model.adminUserPayload({ name: 'Ana', email: 'ana@example.test' }), { code: 'USER_NAME_INVALID' });
  const team = model.adminUserPayload({ name: 'Joao Lima', email: 'joao@example.test', accountType: 'team', role: 'manager', password: 'Senha-forte-2026!' });
  assert.equal(team.role, 'manager');
  assert.equal(team.useCustomPermissions, undefined);
  assert.equal(model.adminProfilePicture('/uploads/profiles/photo.webp'), '/uploads/profiles/photo.webp');
  assert.throws(() => model.adminProfilePicture('https://example.test/photo.webp'), { code: 'USER_PICTURE_INVALID' });
});
