import assert from 'node:assert/strict';
import test from 'node:test';
import { createSecureTokenStorage, createSessionManager, type AuthApi } from './session.js';

test('login stores only refresh token and keeps access token in memory', async () => {
  const storage = memoryStorage();
  const manager = createSessionManager(storage.adapter, fakeAuthApi({
    login: async () => tokens('login-access', 'login-refresh'),
  }));

  await manager.login('owner', 'password');

  assert.equal(storage.refreshToken, 'login-refresh');
  assert.equal(await manager.getAccessToken(), 'login-access');
  assert.deepEqual(storage.writes, ['login-refresh']);
});

test('restored session rotates refresh token after app restart', async () => {
  const storage = memoryStorage();
  const firstManager = createSessionManager(storage.adapter, fakeAuthApi({
    login: async () => tokens('first-access', 'first-refresh'),
  }));
  await firstManager.login('owner', 'password');

  let usedRefreshToken = '';
  const restartedManager = createSessionManager(storage.adapter, fakeAuthApi({
    refresh: async (refreshToken: string) => {
      usedRefreshToken = refreshToken;
      return tokens('restored-access', 'rotated-refresh');
    },
  }));

  assert.equal(await restartedManager.restore(), true);
  assert.equal(usedRefreshToken, 'first-refresh');
  assert.equal(storage.refreshToken, 'rotated-refresh');
  assert.equal(await restartedManager.getAccessToken(), 'restored-access');
});

test('expired access token refreshes and persists the rotated refresh token', async () => {
  const storage = memoryStorage();
  const manager = createSessionManager(storage.adapter, fakeAuthApi({
    login: async () => tokens('expired-access', 'current-refresh', new Date(Date.now() - 1_000).toISOString()),
    refresh: async (refreshToken: string) => {
      assert.equal(refreshToken, 'current-refresh');
      return tokens('new-access', 'next-refresh');
    },
  }));
  await manager.login('owner', 'password');

  assert.equal(await manager.getAccessToken(), 'new-access');
  assert.equal(storage.refreshToken, 'next-refresh');
});

test('logout revokes session and clears secure refresh storage', async () => {
  const storage = memoryStorage();
  let revokedToken = '';
  const manager = createSessionManager(storage.adapter, fakeAuthApi({
    login: async () => tokens('logout-access', 'logout-refresh'),
    logout: async (refreshToken: string) => { revokedToken = refreshToken; },
  }));
  await manager.login('owner', 'password');
  await manager.logout();

  assert.equal(revokedToken, 'logout-refresh');
  assert.equal(storage.refreshToken, null);
  await assert.rejects(manager.getAccessToken(), /sesión/i);
});

test('network failure preserves refresh token for a later retry', async () => {
  const storage = memoryStorage('saved-refresh');
  const manager = createSessionManager(storage.adapter, fakeAuthApi({
    refresh: async () => { throw new Error('No se pudo conectar al servidor.'); },
  }));

  await assert.rejects(manager.restore(), /No se pudo conectar/);
  assert.equal(storage.refreshToken, 'saved-refresh');
});

test('SecureStore adapter uses one private key for read, write, and delete', async () => {
  const calls: Array<[string, ...string[]]> = [];
  const secureStore = {
    async getItemAsync(key: string) { calls.push(['get', key]); return 'stored-refresh'; },
    async setItemAsync(key: string, value: string) { calls.push(['set', key, value]); },
    async deleteItemAsync(key: string) { calls.push(['delete', key]); },
  };
  const adapter = createSecureTokenStorage(secureStore);

  assert.equal(await adapter.getRefreshToken(), 'stored-refresh');
  await adapter.setRefreshToken('new-refresh');
  await adapter.clearRefreshToken();
  assert.deepEqual(calls, [
    ['get', 'finance.refresh-token'],
    ['set', 'finance.refresh-token', 'new-refresh'],
    ['delete', 'finance.refresh-token'],
  ]);
});

function memoryStorage(initial: string | null = null) {
  let refreshToken = initial;
  const writes: string[] = [];
  return {
    get refreshToken() { return refreshToken; },
    writes,
    adapter: {
      async getRefreshToken() { return refreshToken; },
      async setRefreshToken(token: string) { refreshToken = token; writes.push(token); },
      async clearRefreshToken() { refreshToken = null; },
    },
  };
}

function fakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    async login() { return tokens('access', 'refresh'); },
    async refresh() { return tokens('refreshed-access', 'refreshed-refresh'); },
    async logout() {},
    ...overrides,
  };
}

function tokens(accessToken: string, refreshToken: string, accessExpiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return {
    accessToken,
    accessExpiresAt,
    refreshToken,
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
