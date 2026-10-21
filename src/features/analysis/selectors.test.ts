import assert from 'node:assert/strict';
import test from 'node:test';
import { getBudgetProgress, getExpenseCategoryBreakdown, getMonthlyTrend } from './selectors';

test('monthly trend covers six months and excludes transfers', () => {
  const result = getMonthlyTrend({
    movements: [
      { id: 'a', date: '2025-10-04', kind: 'income', amount: 120, note: '' },
      { id: 'b', date: '2026-01-12', kind: 'expense', amount: 20, categoryId: 'food', note: '' },
      { id: 'c', date: '2026-01-18', kind: 'transfer', amount: 90, note: '' },
      { id: 'd', date: '2026-03-01', kind: 'income', amount: 80, note: '' },
    ],
  }, '2026-03');

  assert.deepEqual(result, [
    { month: '2025-10', income: 120, expenses: 0 },
    { month: '2025-11', income: 0, expenses: 0 },
    { month: '2025-12', income: 0, expenses: 0 },
    { month: '2026-01', income: 0, expenses: 20 },
    { month: '2026-02', income: 0, expenses: 0 },
    { month: '2026-03', income: 80, expenses: 0 },
  ]);
});

test('expense breakdown keeps inactive category history and sorts by amount', () => {
  const result = getExpenseCategoryBreakdown({
    categories: [
      { id: 'rent', name: 'Alquiler', kind: 'expense', active: false },
      { id: 'food', name: 'Comida', kind: 'expense', active: true },
    ],
    movements: [
      { id: 'a', date: '2026-03-02', kind: 'expense', amount: 18.25, categoryId: 'rent', note: '' },
      { id: 'b', date: '2026-03-03', kind: 'expense', amount: 30, categoryId: 'food', note: '' },
      { id: 'c', date: '2026-02-04', kind: 'expense', amount: 500, categoryId: 'food', note: '' },
      { id: 'd', date: '2026-03-05', kind: 'transfer', amount: 200, categoryId: 'rent', note: '' },
    ],
  }, '2026-03');

  assert.deepEqual(result, [
    { categoryId: 'food', name: 'Comida', amount: 30 },
    { categoryId: 'rent', name: 'Alquiler', amount: 18.25 },
  ]);
});

test('budget progress reports overspend and caps the visual bar', () => {
  assert.deepEqual(getBudgetProgress(100, 125.5), { spent: 125.5, remaining: -25.5, percent: 125.5, barPercent: 100 });
});
