const networkError = 'No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.';
const expiryListeners = new Set<() => void>();

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let logoutInFlight: Promise<void> | null = null;
let logoutStarting = false;

export function getWebAccessToken() {
  return accessToken;
}

export function clearWebSession() {
  accessToken = null;
}

export function expireWebSession() {
  clearWebSession();
  for (const listener of expiryListeners) listener();
}

export function subscribeToSessionExpiry(listener: () => void) {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export async function loginWeb(username: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, client: 'web' }),
    });
  } catch {
    throw new Error(networkError);
  }

  if (!response.ok) throw await responseError(response);
  const body = await response.json() as { accessToken?: unknown };
  if (typeof body.accessToken !== 'string' || !body.accessToken) {
    throw new Error('El servidor no devolvió una sesión válida.');
  }
  accessToken = body.accessToken;
}

export function refreshWebSession(): Promise<boolean> {
  if (logoutStarting) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = refreshWebSessionOnce().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshWebSessionOnce(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'web' }),
    });
    if (!response.ok) {
      expireWebSession();
      return false;
    }

    const body = await response.json() as { accessToken?: unknown };
    if (typeof body.accessToken !== 'string' || !body.accessToken) {
      expireWebSession();
      return false;
    }
    accessToken = body.accessToken;
    return true;
  } catch {
    expireWebSession();
    return false;
  }
}

export function logoutWeb(): Promise<void> {
  if (!logoutInFlight) {
    logoutStarting = true;
    logoutInFlight = performLogout().finally(() => {
      logoutStarting = false;
      logoutInFlight = null;
    });
  }
  return logoutInFlight;
}

async function performLogout(): Promise<void> {
  try {
    const pendingRefresh = refreshInFlight;
    if (pendingRefresh) await pendingRefresh;
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'web' }),
    });
    if (!response.ok) throw await responseError(response);
  } catch (error) {
    clearWebSession();
    if (error instanceof TypeError) throw new Error(networkError);
    throw error;
  }
  clearWebSession();
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? `Error del servidor (${response.status}).`);
}
