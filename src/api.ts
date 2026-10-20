import { expireWebSession, getWebAccessToken, refreshWebSession } from './auth';

export type Kind = 'income' | 'expense' | 'transfer';
export type AccountId = string;
export type Account = { id: AccountId; name: string; kind: 'cash' | 'bank'; openingBalance: number; startDate: string };
export type Category = { id: string; name: string; kind: 'income' | 'expense'; active: boolean };
export type Movement = {
  id: string;
  date: string;
  kind: Kind;
  amount: number;
  categoryId?: string;
  account?: AccountId;
  toAccount?: AccountId;
  note: string;
};
export type FinanceState = { categories: Category[]; movements: Movement[]; accounts: Account[]; opening: Record<string, number> };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await sendRequest(url, options);
    if (response.status === 401) {
      const refreshed = await refreshWebSession();
      if (refreshed) response = await sendRequest(url, options);
      if (response.status === 401) expireWebSession();
    }
  } catch (error) {
    if (error instanceof TypeError) throw new Error('No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.');
    throw error;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Error del servidor (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function sendRequest(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  const accessToken = getWebAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

export const loadFinanceState = () => request<FinanceState>('/api/state');
export const saveMovement = (movement: Omit<Movement, 'id'> & { id?: string }) => request<Movement>(movement.id ? `/api/movements/${movement.id}` : '/api/movements', { method: movement.id ? 'PUT' : 'POST', body: JSON.stringify(movement) });
export const deleteMovement = (id: string) => request<void>(`/api/movements/${id}`, { method: 'DELETE' });
export const saveCategories = (categories: Category[]) => request<void>('/api/categories', { method: 'PUT', body: JSON.stringify(categories) });
export const saveOpeningBalance = (account: AccountId, openingBalance: number) => request<void>(`/api/accounts/${account}`, { method: 'PUT', body: JSON.stringify({ openingBalance }) });
export const saveAccount = (account: Pick<Account, 'id' | 'name' | 'openingBalance'>) => request<void>(`/api/accounts/${encodeURIComponent(account.id)}`, { method: 'PUT', body: JSON.stringify({ name: account.name, openingBalance: account.openingBalance }) });
export const createBankAccount = (account: { name: string; openingBalance: number; startDate?: string }) => request<Account>('/api/accounts', { method: 'POST', body: JSON.stringify(account) });
