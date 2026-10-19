import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiRequest, createFinanceRequests } from '../../api/client.js';
import type { Category } from '../../api/contracts.js';

type CapturedRequest = { url: string; init: RequestInit };

test('category add, rename, and activation send the complete category list', async () => {
  const requests: CapturedRequest[] = [];
  const api = createFinanceRequests(createRequester(requests));
  const original: Category[] = [
    { id: 'income-1', name: 'Trabajo', kind: 'income', active: true },
    { id: 'expense-1', name: 'Comida', kind: 'expense', active: true },
  ];
  const withNewCategory: Category[] = [...original, { id: 'income-2', name: 'Clases', kind: 'income', active: true }];
  const renamed: Category[] = withNewCategory.map((category) => category.id === 'expense-1' ? { ...category, name: 'Alimentación' } : category);
  const activated: Category[] = renamed.map((category) => category.id === 'income-2' ? { ...category, active: false } : category);

  await api.saveCategories(withNewCategory);
  await api.saveCategories(renamed);
  await api.saveCategories(activated);

  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, 'https://finance.example/api/categories');
  for (const [index, expected] of [withNewCategory, renamed, activated].entries()) {
    assert.equal(requests[index].init.method, 'PUT');
    assert.deepEqual(JSON.parse(String(requests[index].init.body)), expected);
  }
});

test('opening balances send the supported cash and bank account keys', async () => {
  const requests: CapturedRequest[] = [];
  const api = createFinanceRequests(createRequester(requests));

  await api.saveOpeningBalance('cash', 125.5);
  await api.saveOpeningBalance('bank', -8.25);

  assert.deepEqual(requests.map(({ url }) => url), [
    'https://finance.example/api/accounts/cash',
    'https://finance.example/api/accounts/bank',
  ]);
  assert.deepEqual(requests.map(({ init }) => init.method), ['PUT', 'PUT']);
  assert.deepEqual(requests.map(({ init }) => JSON.parse(String(init.body))), [
    { openingBalance: 125.5 },
    { openingBalance: -8.25 },
  ]);
});

function createRequester(requests: CapturedRequest[]) {
  const fetcher: typeof fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(null, { status: 204 });
  };
  const request = createApiRequest({
    baseUrl: () => 'https://finance.example',
    fetcher,
    getAccessToken: async () => 'test-access-token',
    refreshSession: async () => false,
    onSessionExpired: () => {},
  });
  return request;
}
