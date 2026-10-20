import { getApiBaseUrl } from '../api/config';

const networkError = 'No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.';
const accessRefreshSkewMs = 30_000;
export const refreshTokenStorageKey = 'finance.refresh-token';

export type TokenResponse = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

export type SecureTokenStorage = {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
};

export type SecureStoreAdapter = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type AuthApi = {
  login(username: string, password: string): Promise<TokenResponse>;
  refresh(refreshToken: string): Promise<TokenResponse>;
  logout(refreshToken: string): Promise<void>;
  changePassword(accessToken: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<void>;
};

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export type SessionManager = {
  login(username: string, password: string): Promise<void>;
  restore(): Promise<boolean>;
  refresh(): Promise<boolean>;
  getAccessToken(): Promise<string>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void>;
};

export function createSecureTokenStorage(secureStore: SecureStoreAdapter): SecureTokenStorage {
  return {
    getRefreshToken: () => secureStore.getItemAsync(refreshTokenStorageKey),
    setRefreshToken: (token) => secureStore.setItemAsync(refreshTokenStorageKey, token),
    clearRefreshToken: () => secureStore.deleteItemAsync(refreshTokenStorageKey),
  };
}

export function createSessionManager(storage: SecureTokenStorage, authApi: AuthApi): SessionManager {
  let accessToken: string | null = null;
  let accessExpiresAt = 0;
  let refreshInFlight: Promise<boolean> | null = null;
  let logoutInFlight: Promise<void> | null = null;
  let logoutStarting = false;

  function hasFreshAccessToken() {
    return accessToken !== null && Date.now() + accessRefreshSkewMs < accessExpiresAt;
  }

  function clearAccessToken() {
    accessToken = null;
    accessExpiresAt = 0;
  }

  async function acceptTokens(tokens: TokenResponse) {
    const parsedExpiry = Date.parse(tokens.accessExpiresAt);
    if (!tokens.accessToken || !tokens.refreshToken || !Number.isFinite(parsedExpiry)) {
      throw new Error('El servidor no devolvió una sesión válida.');
    }
    await storage.setRefreshToken(tokens.refreshToken);
    accessToken = tokens.accessToken;
    accessExpiresAt = parsedExpiry;
  }

  async function refreshStoredToken(): Promise<boolean> {
    const currentToken = await storage.getRefreshToken();
    if (!currentToken) {
      clearAccessToken();
      return false;
    }

    try {
      await acceptTokens(await authApi.refresh(currentToken));
      return true;
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearAccessToken();
        await storage.clearRefreshToken();
        return false;
      }
      throw error;
    }
  }

  function runRefresh(): Promise<boolean> {
    if (logoutStarting) return Promise.resolve(false);
    if (!refreshInFlight) {
      refreshInFlight = refreshStoredToken().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function refresh() {
    return runRefresh();
  }

  async function restore() {
    if (logoutStarting) return false;
    if (hasFreshAccessToken()) return true;
    return runRefresh();
  }

  async function login(username: string, password: string) {
    if (logoutStarting) throw new Error('Espera a que termine el cierre de sesión.');
    clearAccessToken();
    await acceptTokens(await authApi.login(username, password));
  }

  async function getAccessToken() {
    if (logoutStarting) throw new Error('La sesión está cerrada. Inicia sesión otra vez.');
    if (hasFreshAccessToken()) return accessToken as string;
    const restored = await runRefresh();
    if (!restored || !accessToken) throw new Error('La sesión venció. Inicia sesión otra vez.');
    return accessToken;
  }

  async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    const token = await getAccessToken();
    try {
      await authApi.changePassword(token, currentPassword, newPassword, confirmPassword);
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearAccessToken();
        await storage.clearRefreshToken();
      }
      throw error;
    }
    clearAccessToken();
    await storage.clearRefreshToken();
  }

  function logout(): Promise<void> {
    if (!logoutInFlight) {
      logoutStarting = true;
      logoutInFlight = performLogout().finally(() => {
        logoutStarting = false;
        logoutInFlight = null;
      });
    }
    return logoutInFlight;
  }

  async function performLogout() {
    const pendingRefresh = refreshInFlight;
    if (pendingRefresh) await pendingRefresh.catch(() => false);

    const token = await storage.getRefreshToken().catch(() => null);
    clearAccessToken();
    await storage.clearRefreshToken();
    if (token) await authApi.logout(token);
  }

  return { login, restore, refresh, getAccessToken, logout, changePassword };
}

const secureStoreAdapter: SecureStoreAdapter = {
  async getItemAsync(key) {
    const secureStore = await import('expo-secure-store');
    return secureStore.getItemAsync(key);
  },
  async setItemAsync(key, value) {
    const secureStore = await import('expo-secure-store');
    await secureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key) {
    const secureStore = await import('expo-secure-store');
    await secureStore.deleteItemAsync(key);
  },
};

const authApi: AuthApi = {
  login: (username, password) => requestAuth('/login', { username, password, client: 'android' }),
  refresh: (refreshToken) => requestAuth('/refresh', { refreshToken, client: 'android' }),
  async logout(refreshToken) {
    const response = await sendAuth('/logout', { refreshToken, client: 'android' });
    if (!response.ok) throw await responseError(response);
  },
  async changePassword(accessToken, currentPassword, newPassword, confirmPassword) {
    const response = await sendAuth('/password', { currentPassword, newPassword, confirmPassword }, accessToken);
    if (!response.ok) throw await responseError(response);
  },
};

export const sessionManager = createSessionManager(createSecureTokenStorage(secureStoreAdapter), authApi);

async function requestAuth(path: string, body: Record<string, string>) {
  const response = await sendAuth(path, body);
  if (!response.ok) throw await responseError(response);
  const payload: unknown = await response.json().catch(() => null);
  if (!isTokenResponse(payload)) throw new Error('El servidor no devolvió una sesión válida.');
  return payload;
}

async function sendAuth(path: string, body: Record<string, string>, accessToken?: string) {
  try {
    return await fetch(`${getApiBaseUrl()}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(networkError);
    throw error;
  }
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  const message = typeof payload?.error === 'string' ? payload.error : `Error del servidor (${response.status}).`;
  return new AuthApiError(message, response.status);
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (!value || typeof value !== 'object') return false;
  const tokens = value as Record<string, unknown>;
  return typeof tokens.accessToken === 'string'
    && typeof tokens.accessExpiresAt === 'string'
    && typeof tokens.refreshToken === 'string'
    && typeof tokens.refreshExpiresAt === 'string';
}
