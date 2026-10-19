import assert from 'node:assert/strict';
import test from 'node:test';
import { getMonthlySummary } from './selectors.js';
import type { AccountId, FinanceState, Movement } from '../../api/contracts.js';

test('monthly summary includes first and last day and ignores adjacent months', () => {
  const data = state([
    movement({ id: 'previous', date: '2026-01-31', kind: 'income', amount: 20, toAccount: 'cash' }),
    movement({ id: 'first', date: '2026-02-01', kind: 'income', amount: 100, toAccount: 'cash' }),
    movement({ id: 'last', date: '2026-02-28', kind: 'expense', amount: 15, account: 'cash' }),
    movement({ id: 'next', date: '2026-03-01', kind: 'income', amount: 10, toAccount: 'bank' }),
  ], { cash: 50, bank: 10 });

  const summary = getMonthlySummary(data, '2026-02', 'all');

  assert.deepEqual(summary.movements.map((item) => item.id), ['first', 'last']);
  assert.equal(summary.income, 100);
  assert.equal(summary.expenses, 15);
  assert.equal(summary.net, 85);
  assert.deepEqual(summary.balances, { cash: 155, bank: 10 });
});

test('monthly summary includes leap-day movements in February', () => {
  const data = state([
    movement({ id: 'feb28', date: '2024-02-28', kind: 'income', amount: 12, toAccount: 'cash' }),
    movement({ id: 'feb29', date: '2024-02-29', kind: 'income', amount: 18, toAccount: 'cash' }),
    movement({ id: 'mar01', date: '2024-03-01', kind: 'income', amount: 30, toAccount: 'cash' }),
  ]);

  const summary = getMonthlySummary(data, '2024-02', 'all');

  assert.deepEqual(summary.movements.map((item) => item.id), ['feb28', 'feb29']);
  assert.equal(summary.income, 30);
  assert.equal(summary.balances.cash, 30);
});

test('account filter uses income destination, expense source, and either transfer account', () => {
  const data = state([
    movement({ id: 'cash-income', kind: 'income', amount: 100, toAccount: 'cash' }),
    movement({ id: 'bank-income', kind: 'income', amount: 50, toAccount: 'bank' }),
    movement({ id: 'cash-expense', kind: 'expense', amount: 20, account: 'cash' }),
    movement({ id: 'bank-expense', kind: 'expense', amount: 30, account: 'bank' }),
    movement({ id: 'cash-to-bank', kind: 'transfer', amount: 10, account: 'cash', toAccount: 'bank' }),
    movement({ id: 'bank-to-cash', kind: 'transfer', amount: 7, account: 'bank', toAccount: 'cash' }),
  ]);

  const cash = getMonthlySummary(data, '2026-02', 'cash');
  const bank = getMonthlySummary(data, '2026-02', 'bank');

  assert.deepEqual(cash.movements.map((item) => item.id), ['cash-income', 'cash-expense', 'cash-to-bank', 'bank-to-cash']);
  assert.deepEqual(bank.movements.map((item) => item.id), ['bank-income', 'bank-expense', 'cash-to-bank', 'bank-to-cash']);
  assert.equal(cash.income, 100);
  assert.equal(cash.expenses, 20);
  assert.equal(bank.income, 50);
  assert.equal(bank.expenses, 30);
  assert.deepEqual(cash.balances, { cash: 77, bank: 23 });
  assert.deepEqual(bank.balances, cash.balances);
});

test('transfers change account balances but not income or expense totals', () => {
  const data = state([
    movement({ id: 'income', kind: 'income', amount: 100, toAccount: 'cash' }),
    movement({ id: 'transfer', kind: 'transfer', amount: 40, account: 'cash', toAccount: 'bank' }),
  ], { cash: 5, bank: 10 });

  const summary = getMonthlySummary(data, '2026-02', 'all');

  assert.equal(summary.income, 100);
  assert.equal(summary.expenses, 0);
  assert.equal(summary.net, 100);
  assert.deepEqual(summary.balances, { cash: 65, bank: 50 });
});

function state(movements: Movement[], opening: Record<AccountId, number> = { cash: 0, bank: 0 }): FinanceState {
  return { categories: [], movements, opening };
}

function movement(input: Partial<Movement> & Pick<Movement, 'id'>): Movement {
  return {
    id: input.id,
    date: input.date ?? '2026-02-15',
    kind: input.kind ?? 'expense',
    amount: input.amount ?? 1,
    note: input.note ?? '',
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.account ? { account: input.account } : {}),
    ...(input.toAccount ? { toAccount: input.toAccount } : {}),
  };
}
