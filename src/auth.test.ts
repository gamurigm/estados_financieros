import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { changeWebPassword, clearWebSession, getWebAccessToken, loginWeb, logoutWeb, refreshWebSession } from './auth';
import { loadFinanceState, saveMovement } from './api';

beforeEach(() => {
  clearWebSession();
  globalThis.fetch = async () => jsonResponse({ error: 'Unexpected request.' }, 500);
});

test('initial session restore gets an access token from the HTTP-only cookie', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return jsonResponse({ accessToken: 'restored-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  };

  assert.equal(await refreshWebSession(), true);
  assert.equal(getWebAccessToken(), 'restored-access');
  assert.equal(requests[0].url, '/api/auth/refresh');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { client: 'web' });
});

test('parallel session restores share one refresh request', async () => {
  let refreshRequests = 0;
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => {
    refreshRequests += 1;
    return new Promise<Response>((resolve) => { release = resolve; });
  };

  const first = refreshWebSession();
  const second = refreshWebSession();
  assert.equal(refreshRequests, 1);
  release?.(jsonResponse({ accessToken: 'shared-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() }));
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(getWebAccessToken(), 'shared-access');
});

test('web login keeps the access token in memory and sends no refresh token in JSON', async () => {
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ accessToken: 'login-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  };

  await loginWeb('owner', 'correct password');
  assert.equal(getWebAccessToken(), 'login-access');
  assert.deepEqual(requestBody, { username: 'owner', password: 'correct password', client: 'web' });
  assert.equal('refreshToken' in (requestBody ?? {}), false);
});

test('rejected credentials do not create an access token', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'Usuario o contraseña inválidos.' }, 401);

  await assert.rejects(loginWeb('owner', 'wrong password'), /Usuario o contraseña inválidos/);
  assert.equal(getWebAccessToken(), null);
});

test('finance request refreshes once after 401 and retries with the new access token', async () => {
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/api/auth/login');
    return jsonResponse({ accessToken: 'expired-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  };
  await loginWeb('owner', 'correct password');

  const financeHeaders: string[] = [];
  let financeRequests = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === '/api/auth/refresh') {
      return jsonResponse({ accessToken: 'renewed-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    }
    financeRequests += 1;
    financeHeaders.push(new Headers(init?.headers).get('authorization') ?? '');
    return financeRequests === 1
      ? jsonResponse({ error: 'Sesión no válida.' }, 401)
      : jsonResponse({ categories: [], movements: [], opening: { cash: 0, bank: 0 } });
  };

  const state = await loadFinanceState();
  assert.equal(state.movements.length, 0);
  assert.equal(financeRequests, 2);
  assert.deepEqual(financeHeaders, ['Bearer expired-access', 'Bearer renewed-access']);
});

test('logout revokes the web session and clears the in-memory access token', async () => {
  globalThis.fetch = async (input) => String(input) === '/api/auth/login'
    ? jsonResponse({ accessToken: 'logout-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() })
    : new Response(null, { status: 204 });
  await loginWeb('owner', 'correct password');

  let logoutBody: unknown;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/auth/logout');
    logoutBody = JSON.parse(String(init?.body));
    return new Response(null, { status: 204 });
  };
  await logoutWeb();

  assert.equal(getWebAccessToken(), null);
  assert.deepEqual(logoutBody, { client: 'web' });
});

test('logout waits for a pending refresh before revoking the rotated cookie', async () => {
  const calls: string[] = [];
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === '/api/auth/refresh') {
      return new Promise<Response>((resolve) => { release = resolve; });
    }
    return new Response(null, { status: 204 });
  };

  const refresh = refreshWebSession();
  const logout = logoutWeb();
  assert.deepEqual(calls, ['/api/auth/refresh']);
  release?.(jsonResponse({ accessToken: 'rotated-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() }));
  await refresh;
  await logout;
  assert.deepEqual(calls, ['/api/auth/refresh', '/api/auth/logout']);
});

test('new refresh requests do not start while logout is in flight', async () => {
  const calls: string[] = [];
  let releaseLogout: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === '/api/auth/logout') {
      return new Promise<Response>((resolve) => { releaseLogout = resolve; });
    }
    return jsonResponse({ accessToken: 'late-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  };

  const logout = logoutWeb();
  const lateRefresh = refreshWebSession();
  const lateRefreshResult = await lateRefresh;
  releaseLogout?.(new Response(null, { status: 204 }));
  await logout;
  assert.equal(lateRefreshResult, false);
  assert.deepEqual(calls, ['/api/auth/logout']);
});

test('finance write reports network loss and never returns a saved movement', async () => {
  globalThis.fetch = async () => jsonResponse({ accessToken: 'write-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  await loginWeb('owner', 'correct password');

  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    saveMovement({ date: '2026-10-19', kind: 'expense', amount: 5, categoryId: 'food', account: 'cash', note: 'test' }),
    /No se pudo conectar al servidor/,
  );
  assert.equal(authorization, 'Bearer write-access');
});

test('password change sends bearer credentials and clears the web session', async () => {
  globalThis.fetch = async () => jsonResponse({ accessToken: 'password-access', accessExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  await loginWeb('owner', 'correct password');

  let requestBody: unknown;
  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    requestBody = JSON.parse(String(init?.body));
    return new Response(null, { status: 204 });
  };
  await changeWebPassword('old password', 'new password', 'new password');

  assert.equal(authorization, 'Bearer password-access');
  assert.deepEqual(requestBody, { currentPassword: 'old password', newPassword: 'new password', confirmPassword: 'new password' });
  assert.equal(getWebAccessToken(), null);
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
