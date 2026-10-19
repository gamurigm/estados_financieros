import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Pool } from 'pg';
import { hashPassword } from './auth-crypto.js';
import { createApp } from './app.js';

type NewSession = {
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
};

type SessionRecord = NewSession & { id: string };

type MemoryAuthStore = {
  findOwner(username: string): Promise<{ username: string; passwordHash: string } | null>;
  createSession(session: NewSession): Promise<void>;
  findActiveAccessToken(tokenHash: string, now: Date): Promise<{ id: string } | null>;
  rotateRefreshToken(currentHash: string, next: NewSession, now: Date): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, now: Date): Promise<void>;
};

type Route = { method: string; path: string; body?: unknown };

const protectedRoutes: Route[] = [
  { method: 'GET', path: '/api/state' },
  { method: 'POST', path: '/api/movements', body: {} },
  { method: 'PUT', path: '/api/movements/00000000-0000-0000-0000-000000000001', body: {} },
  { method: 'DELETE', path: '/api/movements/00000000-0000-0000-0000-000000000001' },
  { method: 'PUT', path: '/api/categories', body: [] },
  { method: 'PUT', path: '/api/accounts/cash', body: { openingBalance: 0 } },
];

test('web and Android login return refresh tokens through their approved channels', async () => {
  const harness = await startHarness();
  try {
    const webResponse = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'owner', password: 'correct password', client: 'web' },
    });
    assert.equal(webResponse.status, 200);
    const webBody = await webResponse.json() as Record<string, unknown>;
    assert.equal(typeof webBody.accessToken, 'string');
    assert.equal('refreshToken' in webBody, false);
    assert.match(webResponse.headers.get('set-cookie') ?? '', /HttpOnly/i);
    assert.match(webResponse.headers.get('set-cookie') ?? '', /SameSite=Strict/i);

    const androidResponse = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'owner', password: 'correct password', client: 'android' },
    });
    assert.equal(androidResponse.status, 200);
    const androidBody = await androidResponse.json() as Record<string, unknown>;
    assert.equal(typeof androidBody.accessToken, 'string');
    assert.equal(typeof androidBody.refreshToken, 'string');
    assert.equal(androidResponse.headers.get('set-cookie'), null);
  } finally {
    await harness.close();
  }
});

test('production web refresh cookie is secure', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let harness: Awaited<ReturnType<typeof startHarness>> | undefined;
  try {
    harness = await startHarness();
    const response = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'owner', password: 'correct password', client: 'web' },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie') ?? '', /Secure/i);
  } finally {
    await harness?.close();
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('unknown owner and wrong password return the same credential error', async () => {
  const harness = await startHarness();
  try {
    const wrongPassword = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'owner', password: 'wrong password', client: 'android' },
    });
    const unknownOwner = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'unknown', password: 'wrong password', client: 'android' },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownOwner.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownOwner.json());
  } finally {
    await harness.close();
  }
});

test('Android refresh rotates access and refresh tokens and rejects the old refresh token', async () => {
  const harness = await startHarness();
  try {
    const first = await loginAndroid(harness.baseUrl);
    const refreshed = await send(harness.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      body: { client: 'android', refreshToken: first.refreshToken },
    });
    assert.equal(refreshed.status, 200);
    const second = await refreshed.json() as Record<string, unknown>;
    assert.notEqual(second.accessToken, first.accessToken);
    assert.notEqual(second.refreshToken, first.refreshToken);

    const reused = await send(harness.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      body: { client: 'android', refreshToken: first.refreshToken },
    });
    assert.equal(reused.status, 401);
  } finally {
    await harness.close();
  }
});

test('web refresh rotates the HTTP-only cookie without returning it in JSON', async () => {
  const harness = await startHarness();
  try {
    const first = await send(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'owner', password: 'correct password', client: 'web' },
    });
    const oldCookie = cookiePair(first.headers.get('set-cookie'));
    const refreshed = await send(harness.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: oldCookie },
      body: { client: 'web' },
    });
    assert.equal(refreshed.status, 200);
    const body = await refreshed.json() as Record<string, unknown>;
    const newCookie = cookiePair(refreshed.headers.get('set-cookie'));
    assert.notEqual(newCookie, oldCookie);
    assert.equal('refreshToken' in body, false);

    const oldCookieResponse = await send(harness.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: oldCookie },
      body: { client: 'web' },
    });
    assert.equal(oldCookieResponse.status, 401);
  } finally {
    await harness.close();
  }
});

test('logout revokes Android refresh and access tokens', async () => {
  const harness = await startHarness();
  try {
    const tokens = await loginAndroid(harness.baseUrl);
    const logout = await send(harness.baseUrl, '/api/auth/logout', {
      method: 'POST',
      body: { client: 'android', refreshToken: tokens.refreshToken },
    });
    assert.equal(logout.status, 204);

    const state = await send(harness.baseUrl, '/api/state', {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    assert.equal(state.status, 401);

    const refresh = await send(harness.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      body: { client: 'android', refreshToken: tokens.refreshToken },
    });
    assert.equal(refresh.status, 401);
  } finally {
    await harness.close();
  }
});

for (const scenario of ['missing', 'expired', 'revoked', 'malformed'] as const) {
  test(`${scenario} access tokens cannot reach any finance route`, async () => {
    const harness = await startHarness();
    try {
      let authorization: string | undefined;
      if (scenario === 'expired' || scenario === 'revoked') {
        const token = `${scenario}-access-token`;
        const refreshToken = `${scenario}-refresh-token`;
        await harness.store.authStore.createSession({
          accessTokenHash: hashToken(token),
          accessExpiresAt: scenario === 'expired' ? new Date(Date.now() - 1_000) : new Date(Date.now() + 60_000),
          refreshTokenHash: hashToken(refreshToken),
          refreshExpiresAt: new Date(Date.now() + 60_000),
        });
        if (scenario === 'revoked') await harness.store.authStore.revokeRefreshToken(hashToken(refreshToken), new Date());
        authorization = `Bearer ${token}`;
      } else if (scenario === 'malformed') {
        authorization = 'Bearer malformed.token';
      }

      for (const route of protectedRoutes) {
        const before = harness.databaseCalls.length;
        const response = await send(harness.baseUrl, route.path, {
          method: route.method,
          body: route.body,
          headers: authorization ? { authorization } : undefined,
        });
        assert.equal(response.status, 401, `${route.method} ${route.path}`);
        assert.equal(harness.databaseCalls.length, before, `${route.method} ${route.path} reached PostgreSQL`);
      }
    } finally {
      await harness.close();
    }
  });
}

test('authenticated owner can read finance state and health remains public', async () => {
  const harness = await startHarness();
  try {
    const health = await send(harness.baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const tokens = await loginAndroid(harness.baseUrl);
    const state = await send(harness.baseUrl, '/api/state', {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    assert.equal(state.status, 200);
    assert.deepEqual(await state.json(), {
      categories: [],
      movements: [],
      opening: { cash: 0, bank: 0 },
    });
  } finally {
    await harness.close();
  }
});

test('login is limited to ten attempts per IP in fifteen minutes', async () => {
  const harness = await startHarness();
  try {
    const responses: Response[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await send(harness.baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { username: 'unknown', password: 'wrong password', client: 'android' },
      }));
    }
    assert.equal(responses.slice(0, 10).every((response) => response.status === 401), true);
    assert.equal(responses[10].status, 429);
  } finally {
    await harness.close();
  }
});

async function startHarness() {
  const store = await createMemoryAuthStore();
  const databaseCalls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      databaseCalls.push(sql);
      if (sql.includes('FROM categories')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM movements')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM accounts')) {
        return { rows: [{ account_key: 'cash', opening_balance: '0' }, { account_key: 'bank', opening_balance: '0' }], rowCount: 2 };
      }
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    },
  } as unknown as Pool;
  const server = createServer(createApp(pool, store.authStore));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    databaseCalls,
    store,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

async function createMemoryAuthStore() {
  const sessions = new Map<string, SessionRecord>();
  const owner = { username: 'owner', passwordHash: await hashPassword('correct password') };
  const authStore: MemoryAuthStore = {
    async findOwner(username) {
      return username === owner.username ? owner : null;
    },
    async createSession(session) {
      sessions.set(session.refreshTokenHash, { id: `session-${sessions.size + 1}`, ...session });
    },
    async findActiveAccessToken(tokenHash, now) {
      const session = [...sessions.values()].find((candidate) => candidate.accessTokenHash === tokenHash);
      if (!session || session.accessExpiresAt <= now || session.refreshExpiresAt <= now) return null;
      return { id: session.id };
    },
    async rotateRefreshToken(currentHash, next, now) {
      const session = sessions.get(currentHash);
      if (!session || session.refreshExpiresAt <= now) return false;
      sessions.delete(currentHash);
      sessions.set(next.refreshTokenHash, { id: session.id, ...next });
      return true;
    },
    async revokeRefreshToken(tokenHash) {
      sessions.delete(tokenHash);
    },
  };

  return { authStore, sessions };
}

async function loginAndroid(baseUrl: string) {
  const response = await send(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { username: 'owner', password: 'correct password', client: 'android' },
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<Record<string, string>>;
}

async function send(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function cookiePair(value: string | null) {
  assert.ok(value, 'expected refresh cookie');
  return value.split(';', 1)[0];
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
