import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import twoFactor from '../backend/services/adminTwoFactorService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('identity HTTP: admin login, session revocation, guard and customer isolation', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cine-phase21-identity-'));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(dir, 'db.json');
  await writeFile(dataFile, JSON.stringify({
    settings: { adminTwoFactorRequired: false },
    users: [{ id: 'qa-owner', name: 'Administrador QA', email: 'qa-owner@example.test', role: 'owner', active: true, passwordHash: '' }],
    movies: [], rooms: [], orders: [], tickets: []
  }));
  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port), BIND_HOST: '127.0.0.1', NODE_ENV: 'test', DATA_STORE: 'json', CINE_DATA_FILE: dataFile,
      CINE_UPLOADS_DIR: path.join(dir, 'uploads'), CINE_EMAIL_ATTACHMENTS_DIR: path.join(dir, 'email'),
      CINE_TICKET_DOCUMENTS_DIR: path.join(dir, 'tickets'), JWT_SECRET: 'phase21-identity-local-secret',
      MOVIE_IMAGE_MAINTENANCE_ENABLED: 'false', FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base,
      ADMIN_EMAIL: 'qa-owner@example.test', ADMIN_PASSWORD: 'Admin-identity-2026!'
    }
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}: ${output.slice(-2000)}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await wait(100);
    }
    assert.ok(ready, `isolated backend ready: ${output.slice(-1000)}`);
    const request = async (route, method = 'GET', body, cookie = '', origin = '') => {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const raw = await response.text();
      return { response, body: raw ? JSON.parse(raw) : null };
    };
    const anonymous = await request('/api/admin/me');
    assert.equal(anonymous.response.status, 401);
    assert.equal(anonymous.body.error.code, 'ADMIN_AUTH_REQUIRED');
    const invalid = await request('/api/admin/login', 'POST', { email: 'qa-owner@example.test', password: 'wrong' });
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.body.error.code, 'ADMIN_LOGIN_INVALID');
    const login = await request('/api/admin/login', 'POST', { email: 'qa-owner@example.test', password: 'Admin-identity-2026!' });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const cookieHeader = login.response.headers.get('set-cookie') || '';
    assert.match(cookieHeader, /^cine_admin=/);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    const cookie = cookieHeader.split(';')[0];
    assert.equal((await request('/api/admin/me', 'GET', undefined, cookie)).response.status, 200);
    const blocked = await request('/api/admin/me', 'PATCH', { name: 'Admin Changed' }, cookie, 'https://untrusted.example.test');
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.body.error.code, 'ADMIN_CSRF_BLOCKED');
    const profile = await request('/api/admin/me', 'PATCH', { name: 'Administrador Atualizado' }, cookie);
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.user.name, 'Administrador Atualizado');
    const wrongPassword = await request('/api/admin/me/password', 'POST', {
      currentPassword: 'wrong', newPassword: 'Outra-senha-2026!', confirmPassword: 'Outra-senha-2026!'
    }, cookie);
    assert.equal(wrongPassword.response.status, 422);
    assert.equal(wrongPassword.body.error.code, 'CURRENT_PASSWORD_INVALID');
    const twoFactorStatus = await request('/api/admin/2fa/status', 'GET', undefined, cookie);
    assert.equal(twoFactorStatus.response.status, 200);
    assert.equal(twoFactorStatus.body.enabled, false);
    const policy = await request('/api/admin/security-policy', 'GET', undefined, cookie);
    assert.equal(policy.response.status, 200);
    assert.equal(policy.body.adminTwoFactorRequired, false);
    const setup = await request('/api/admin/2fa/setup', 'POST', { password: 'Admin-identity-2026!' }, cookie);
    assert.equal(setup.response.status, 200, JSON.stringify(setup.body));
    assert.ok(setup.body.secret);
    const enabled = await request('/api/admin/2fa/enable', 'POST', { code: twoFactor.totp(setup.body.secret) }, cookie);
    assert.equal(enabled.response.status, 200, JSON.stringify(enabled.body));
    assert.equal(enabled.body.recoveryCodes.length, 10);
    const customerOnly = await request('/api/auth/me', 'GET', undefined, cookie);
    assert.equal(customerOnly.response.status, 401);
    const logout = await request('/api/admin/logout', 'POST', undefined, cookie);
    assert.equal(logout.response.status, 204);
    assert.match(logout.response.headers.get('set-cookie') || '', /Max-Age=0/);
    assert.equal((await request('/api/admin/me', 'GET', undefined, cookie)).response.status, 401);
    const challengeLogin = await request('/api/admin/login', 'POST', { email: 'qa-owner@example.test', password: 'Admin-identity-2026!' });
    assert.equal(challengeLogin.response.status, 202, JSON.stringify(challengeLogin.body));
    assert.equal(challengeLogin.body.twoFactorRequired, true);
    const invalidCode = await request('/api/admin/login/2fa', 'POST', { challenge: challengeLogin.body.challenge, code: '000000' });
    assert.equal(invalidCode.response.status, 401);
    const verifiedCode = await request('/api/admin/login/2fa', 'POST', { challenge: challengeLogin.body.challenge, code: twoFactor.totp(setup.body.secret) });
    assert.equal(verifiedCode.response.status, 200, JSON.stringify(verifiedCode.body));
    const verifiedCookie = (verifiedCode.response.headers.get('set-cookie') || '').split(';')[0];
    assert.equal((await request('/api/admin/me', 'GET', undefined, verifiedCookie)).response.status, 200);
    const replay = await request('/api/admin/login/2fa', 'POST', { challenge: challengeLogin.body.challenge, code: twoFactor.totp(setup.body.secret) });
    assert.equal(replay.response.status, 401);
    const changedAdminPassword = await request('/api/admin/me/password', 'POST', {
      currentPassword: 'Admin-identity-2026!', newPassword: 'Admin-nova-2026!', confirmPassword: 'Admin-nova-2026!'
    }, verifiedCookie);
    assert.equal(changedAdminPassword.response.status, 200, JSON.stringify(changedAdminPassword.body));
    const rotatedAdminCookie = (changedAdminPassword.response.headers.get('set-cookie') || '').split(';')[0];
    assert.equal((await request('/api/admin/me', 'GET', undefined, verifiedCookie)).response.status, 401);
    assert.equal((await request('/api/admin/me', 'GET', undefined, rotatedAdminCookie)).response.status, 200);
    const stored = JSON.parse(await readFile(dataFile, 'utf8'));
    assert.ok(stored.auditLogs.some((entry) => entry.action === 'POST /api/admin/logout'));
    assert.ok(stored.users.find((user) => user.email === 'qa-owner@example.test').sessionVersion > 0);

    const account = { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.test', password: 'Senha-forte-2026!' };
    const created = await request('/api/auth/register', 'POST', account);
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    const firstCustomerCookie = (created.response.headers.get('set-cookie') || '').split(';')[0];
    assert.match(firstCustomerCookie, /^cine_customer=/);
    assert.equal((await request('/api/auth/me', 'GET', undefined, firstCustomerCookie)).response.status, 200);
    assert.equal((await request('/api/admin/me', 'GET', undefined, firstCustomerCookie)).response.status, 401);
    const invalidCustomer = await request('/api/auth/login', 'POST', { email: account.email, password: 'wrong' });
    assert.equal(invalidCustomer.response.status, 401);
    const customerLogin = await request('/api/auth/login', 'POST', { email: account.email, password: account.password });
    assert.equal(customerLogin.response.status, 200);
    const customerCookie = (customerLogin.response.headers.get('set-cookie') || '').split(';')[0];
    const recovery = await request('/api/auth/password/request', 'POST', { email: account.email });
    assert.equal(recovery.response.status, 202);
    assert.ok(recovery.body.resetToken, 'nonproduction reset token for isolated test');
    const reset = await request('/api/auth/password/reset', 'POST', { token: recovery.body.resetToken, password: 'Outra-senha-2026!' });
    assert.equal(reset.response.status, 200);
    assert.match(reset.response.headers.get('set-cookie') || '', /^cine_customer=/);
    assert.equal((await request('/api/auth/me', 'GET', undefined, customerCookie)).response.status, 401);
    const newCustomerCookie = (reset.response.headers.get('set-cookie') || '').split(';')[0];
    const blockedCustomerOrigin = await request('/api/me', 'PATCH', { name: 'Ana Silva' }, newCustomerCookie, 'https://untrusted.example.test');
    assert.equal(blockedCustomerOrigin.response.status, 403);
    const invalidName = await request('/api/me', 'PATCH', { name: 'Ana' }, newCustomerCookie);
    assert.equal(invalidName.response.status, 422);
    assert.equal(invalidName.body.error.code, 'CUSTOMER_NAME_INVALID');
    const invalidEmailToken = await request('/api/auth/email/verify', 'POST', { token: 'invalid' });
    assert.equal(invalidEmailToken.response.status, 400);
    assert.equal(invalidEmailToken.body.error.code, 'EMAIL_VERIFICATION_INVALID');
    const changeEmail = await request('/api/me/email-change/request', 'POST', { email: 'ana.new@example.test' }, newCustomerCookie);
    assert.equal(changeEmail.response.status, 202, JSON.stringify(changeEmail.body));
    assert.ok(changeEmail.body.verificationToken);
    const confirmed = await request('/api/me/email-change/confirm', 'POST', { token: changeEmail.body.verificationToken });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.user.email, 'ana.new@example.test');
    const confirmedCookie = (confirmed.response.headers.get('set-cookie') || '').split(';')[0];
    const customerLogout = await request('/api/auth/logout', 'POST', undefined, confirmedCookie);
    assert.equal(customerLogout.response.status, 200);
    assert.equal(customerLogout.body.ok, true);
    assert.match(customerLogout.response.headers.get('set-cookie') || '', /Max-Age=0/);
    assert.equal((await request('/api/auth/me', 'GET', undefined, confirmedCookie)).response.status, 401);

    const team = await request('/api/users', 'POST', {
      name: 'Operador Teste', email: 'operator@example.test', accountType: 'team', role: 'operator', password: 'Operator-2026!'
    }, rotatedAdminCookie);
    assert.equal(team.response.status, 201, JSON.stringify(team.body));
    const teamLogin = await request('/api/admin/login', 'POST', { email: 'operator@example.test', password: 'Operator-2026!' });
    assert.equal(teamLogin.response.status, 200);
    const teamCookie = (teamLogin.response.headers.get('set-cookie') || '').split(';')[0];
    const forbiddenUsers = await request('/api/users', 'GET', undefined, teamCookie);
    assert.equal(forbiddenUsers.response.status, 403);
    assert.equal(forbiddenUsers.body.error.code, 'ADMIN_FORBIDDEN');
    const disabled = await request(`/api/users/${encodeURIComponent(team.body.id)}`, 'PUT', { name: 'Operador Teste', email: 'operator@example.test', active: false }, rotatedAdminCookie);
    assert.equal(disabled.response.status, 200, JSON.stringify(disabled.body));
    assert.equal((await request('/api/admin/me', 'GET', undefined, teamCookie)).response.status, 401);
    assert.equal((await request('/api/admin/login', 'POST', { email: 'operator@example.test', password: 'Operator-2026!' })).response.status, 401);

    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await request('/api/auth/login', 'POST', { email: 'blocked@example.test', password: 'wrong' })).response.status, 401);
    }
    const rateBlocked = await request('/api/auth/login', 'POST', { email: 'blocked@example.test', password: 'wrong' });
    assert.equal(rateBlocked.response.status, 429);
    assert.equal(rateBlocked.body.error.code, 'CUSTOMER_LOGIN_BLOCKED');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(dir, { recursive: true, force: true });
  }
});
