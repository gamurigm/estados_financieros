import type { RequestHandler } from 'express';
import { hashToken } from './auth.js';
import type { AuthStore } from './auth-store.js';

export function requireAuth(store: AuthStore): RequestHandler {
  return async (request, response, next) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.get('authorization') ?? '');
    if (!match) return response.status(401).json({ error: 'Sesión no válida.' });

    const session = await store.findActiveAccessToken(hashToken(match[1]), new Date());
    if (!session) return response.status(401).json({ error: 'Sesión no válida.' });
    next();
  };
}
