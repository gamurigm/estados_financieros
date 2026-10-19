import { getApiBaseUrl } from './config';
import { sessionManager } from '../auth/session';
import type { Movement } from './contracts';
import { router } from 'expo-router';

const networkError = 'No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('La ruta del servidor no es válida.');
  const url = `${getApiBaseUrl()}${path}`;
  let response = await sendAuthorizedRequest(url, init);
  if (response.status === 401 && await sessionManager.refresh()) {
    response = await sendAuthorizedRequest(url, init);
  }
  if (response.status === 401) {
    router.replace('/login');
    throw new Error('La sesión venció. Inicia sesión otra vez.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Error del servidor (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function saveMovement(movement: Omit<Movement, 'id'>, id?: string) {
  const path = id ? `/api/movements/${encodeURIComponent(id)}` : '/api/movements';
  return apiRequest<Movement>(path, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(movement),
  });
}

export function deleteMovement(id: string) {
  return apiRequest<void>(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function sendAuthorizedRequest(url: string, init?: RequestInit) {
  const accessToken = await sessionManager.getAccessToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  try {
    return await fetch(url, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(networkError);
    throw error;
  }
}
