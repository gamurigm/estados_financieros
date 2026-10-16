export type Kind = 'income' | 'expense' | 'transfer';
export type AccountId = 'cash' | 'bank';
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
export type FinanceState = { categories: Category[]; movements: Movement[]; opening: Record<AccountId, number> };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Error del servidor (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const loadFinanceState = () => request<FinanceState>('/api/state');
export const saveMovement = (movement: Omit<Movement, 'id'> & { id?: string }) => request<Movement>(movement.id ? `/api/movements/${movement.id}` : '/api/movements', { method: movement.id ? 'PUT' : 'POST', body: JSON.stringify(movement) });
export const deleteMovement = (id: string) => request<void>(`/api/movements/${id}`, { method: 'DELETE' });
export const saveCategories = (categories: Category[]) => request<void>('/api/categories', { method: 'PUT', body: JSON.stringify(categories) });
export const saveOpeningBalance = (account: AccountId, openingBalance: number) => request<void>(`/api/accounts/${account}`, { method: 'PUT', body: JSON.stringify({ openingBalance }) });
