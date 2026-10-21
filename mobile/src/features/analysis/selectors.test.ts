import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceState, Movement } from '../../api/contracts.js';
import { getBudgetProgress, getExpenseCategoryBreakdown, getMonthlyTrend } from './selectors.js';

test('six-month trend counts income and expenses, but excludes transfers', () => {
  const data = state([
    movement({ id: 'feb-income', date: '2026-02-01', kind: 'income', amount: 100, toAccount: 'cash' }),
    movement({ id: 'feb-transfer', date: '2026-02-28', kind: 'transfer', amount: 80, account: 'cash', toAccount: 'bank' }),
    movement({ id: 'mar-expense', date: '2026-03-31', amount: 20, categoryId: 'food' }),
    movement({ id: 'aug-income', date: '2026-08-31', kind: 'income', amount: 50, toAccount: 'bank' }),
    movement({ id: 'aug-transfer', date: '2026-08-15', kind: 'transfer', amount: 70, account: 'cash', toAccount: 'bank' }),
    movement({ id: 'sep-expense', date: '2026-09-01', amount: 7, categoryId: 'travel' }),
  ]);

  assert.deepEqual(getMonthlyTrend(data, '2026-09'), [
    { month: '2026-04', income: 0, expenses: 0 },
    { month: '2026-05', income: 0, expenses: 0 },
    { month: '2026-06', income: 0, expenses: 0 },
    { month: '2026-07', income: 0, expenses: 0 },
    { month: '2026-08', income: 50, expenses: 0 },
    { month: '2026-09', income: 0, expenses: 7 },
  ]);
});

test('expense breakdown groups by category and sorts highest spending first', () => {
  const data = state([
    movement({ id: 'food-1', amount: 18, categoryId: 'food' }),
    movement({ id: 'travel', amount: 32, categoryId: 'travel' }),
    movement({ id: 'food-2', amount: 12, categoryId: 'food' }),
    movement({ id: 'income', kind: 'income', amount: 500, categoryId: 'food', toAccount: 'cash' }),
    movement({ id: 'transfer', kind: 'transfer', amount: 60, account: 'cash', toAccount: 'bank' }),
  ]);

  assert.deepEqual(getExpenseCategoryBreakdown(data, '2026-02'), [
    { categoryId: 'travel', name: 'Transporte', amount: 32 },
    { categoryId: 'food', name: 'Comida', amount: 30 },
  ]);
});

test('budget progress keeps overspend amount visible and caps only the bar', () => {
  assert.deepEqual(getBudgetProgress(100, 125), {
    spent: 125,
    remaining: -25,
    percent: 125,
    barPercent: 100,
  });
});

function state(movements: Movement[]): FinanceState {
  return {
    categories: [
      { id: 'food', name: 'Comida', kind: 'expense', active: false },
      { id: 'travel', name: 'Transporte', kind: 'expense', active: true },
    ],
    movements,
    accounts: [
      { id: 'cash', name: 'Efectivo', kind: 'cash', openingBalance: 0, startDate: '1900-01-01' },
      { id: 'bank', name: 'Banco', kind: 'bank', openingBalance: 0, startDate: '1900-01-01' },
    ],
    opening: { cash: 0, bank: 0 },
  };
}

function movement(input: Partial<Movement> & Pick<Movement, 'id'>): Movement {
  return {
    id: input.id,
    date: input.date ?? '2026-02-15',
    kind: input.kind ?? 'expense',
    amount: input.amount ?? 1,
    note: '',
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.account ? { account: input.account } : {}),
    ...(input.toAccount ? { toAccount: input.toAccount } : {}),
  };
}
