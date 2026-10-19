import { createHash, randomBytes } from 'node:crypto';
import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verifyPassword } from './auth-crypto.js';
import type { AuthStore, NewSession } from './auth-store.js';

const refreshCookieName = 'finance_refresh';
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const accessLifetimeMs = 15 * 60 * 1000;
const invalidCredentials = { error: 'Usuario o contraseña inválidos.' };

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthRouter(store: AuthStore) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
  });

  router.post('/login', loginLimiter, async (request, response) => {
    const { username, password, client } = request.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !isClient(client)) {
      return response.status(400).json({ error: 'Datos de inicio de sesión inválidos.' });
    }

    const owner = await store.findOwner(username.trim());
    const validPassword = owner ? await verifyPassword(password, owner.passwordHash) : false;
    if (!owner || !validPassword) return response.status(401).json(invalidCredentials);

    const tokens = newSession();
    await store.createSession(tokens.session);
    return sendTokens(response, client, tokens);
  });

  router.post('/refresh', async (request, response) => {
    const { client } = request.body ?? {};
    if (!isClient(client)) return response.status(400).json({ error: 'Cliente inválido.' });

    const currentToken = client === 'web'
      ? request.cookies?.[refreshCookieName]
      : request.body?.refreshToken;
    if (typeof currentToken !== 'string' || !isOpaqueToken(currentToken)) {
      clearRefreshCookie(response, client);
      return response.status(401).json({ error: 'Sesión no válida.' });
    }

    const tokens = newSession();
    const rotated = await store.rotateRefreshToken(hashToken(currentToken), tokens.session, new Date());
    if (!rotated) {
      clearRefreshCookie(response, client);
      return response.status(401).json({ error: 'Sesión no válida.' });
    }

    return sendTokens(response, client, tokens);
  });

  router.post('/logout', async (request, response) => {
    const { client } = request.body ?? {};
    if (!isClient(client)) return response.status(400).json({ error: 'Cliente inválido.' });

    const token = client === 'web'
      ? request.cookies?.[refreshCookieName]
      : request.body?.refreshToken;
    if (typeof token === 'string' && isOpaqueToken(token)) {
      await store.revokeRefreshToken(hashToken(token), new Date());
    }
    clearRefreshCookie(response, client);
    return response.status(204).end();
  });

  return router;
}

function newSession() {
  const now = new Date();
  const accessToken = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(32).toString('base64url');
  const session: NewSession = {
    accessTokenHash: hashToken(accessToken),
    accessExpiresAt: new Date(now.getTime() + accessLifetimeMs),
    refreshTokenHash: hashToken(refreshToken),
    refreshExpiresAt: new Date(now.getTime() + refreshLifetimeMs),
  };
  return { accessToken, refreshToken, session };
}

function sendTokens(
  response: Response,
  client: 'web' | 'android',
  tokens: ReturnType<typeof newSession>,
) {
  const body = {
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.session.accessExpiresAt.toISOString(),
  };
  if (client === 'web') {
    response.cookie(refreshCookieName, tokens.refreshToken, cookieOptions());
    return response.json(body);
  }
  return response.json({
    ...body,
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: tokens.session.refreshExpiresAt.toISOString(),
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: refreshLifetimeMs,
  };
}

function clearRefreshCookie(response: Response, client: 'web' | 'android') {
  if (client === 'web') {
    const { maxAge: _maxAge, ...options } = cookieOptions();
    response.clearCookie(refreshCookieName, options);
  }
}

function isClient(value: unknown): value is 'web' | 'android' {
  return value === 'web' || value === 'android';
}

function isOpaqueToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
