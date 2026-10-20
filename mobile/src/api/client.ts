import { getApiBaseUrl } from './config';
import { sessionManager } from '../auth/session';
import type { Account, AccountId, Category, FinanceState, Movement } from './contracts';

const networkError = 'No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.';

type ApiRequester = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createApiRequest({
  baseUrl,
  fetcher,
  getAccessToken,
  refreshSession,
  onSessionExpired,
}: {
  baseUrl: () => string;
  fetcher: typeof fetch;
  getAccessToken: () => Promise<string>;
  refreshSession: () => Promise<boolean>;
  onSessionExpired: () => void | Promise<void>;
}): ApiRequester {
  return async function request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!path.startsWith('/api/')) throw new Error('La ruta del servidor no es válida.');
    const url = `${baseUrl()}${path}`;
    let response = await sendAuthorizedRequest(url, init, fetcher, getAccessToken);
    if (response.status === 401 && await refreshSession()) {
      response = await sendAuthorizedRequest(url, init, fetcher, getAccessToken);
    }
    if (response.status === 401) {
      await onSessionExpired();
      throw new Error('La sesión venció. Inicia sesión otra vez.');
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof payload?.error === 'string' ? payload.error : `Error del servidor (${response.status}).`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  };
}

export function createFinanceRequests(request: ApiRequester) {
  return {
    loadFinanceState: () => request<FinanceState>('/api/state'),
    saveMovement: (movement: Omit<Movement, 'id'>, id?: string) => {
      const path = id ? `/api/movements/${encodeURIComponent(id)}` : '/api/movements';
      return request<Movement>(path, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(movement),
      });
    },
    deleteMovement: (id: string) => request<void>(`/api/movements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    saveCategories: (categories: Category[]) => request<void>('/api/categories', {
      method: 'PUT',
      body: JSON.stringify(categories),
    }),
    saveOpeningBalance: (account: AccountId, openingBalance: number) => request<void>(`/api/accounts/${account}`, {
      method: 'PUT',
      body: JSON.stringify({ openingBalance }),
    }),
    saveAccount: (account: Pick<Account, 'id' | 'name' | 'openingBalance'>) => request<void>(`/api/accounts/${encodeURIComponent(account.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: account.name, openingBalance: account.openingBalance }),
    }),
    createBankAccount: (account: { name: string; openingBalance: number; startDate?: string }) => request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    }),
  };
}

const request = createApiRequest({
  baseUrl: getApiBaseUrl,
  fetcher: (...args) => fetch(...args),
  getAccessToken: () => sessionManager.getAccessToken(),
  refreshSession: () => sessionManager.refresh(),
  onSessionExpired: async () => {
    const { router } = await import('expo-router');
    router.replace('/login');
  },
});
const financeRequests = createFinanceRequests(request);

export const apiRequest = request;
export const loadFinanceState = financeRequests.loadFinanceState;
export const saveMovement = financeRequests.saveMovement;
export const deleteMovement = financeRequests.deleteMovement;
export const saveCategories = financeRequests.saveCategories;
export const saveOpeningBalance = financeRequests.saveOpeningBalance;
export const saveAccount = financeRequests.saveAccount;
export const createBankAccount = financeRequests.createBankAccount;

async function sendAuthorizedRequest(
  url: string,
  init: RequestInit | undefined,
  fetcher: typeof fetch,
  getAccessToken: () => Promise<string>,
) {
  const accessToken = await getAccessToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  try {
    return await fetcher(url, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(networkError);
    throw error;
  }
}
