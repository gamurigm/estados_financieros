import assert from 'node:assert/strict';
import test from 'node:test';
import { getAccountBalanceAsOf, getDailyTotals, getMonthlySummary } from './selectors.js';
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

test('daily totals group income and expenses and leave transfers out', () => {
  const totals = getDailyTotals([
    movement({ id: 'income', date: '2026-02-05', kind: 'income', amount: 100, toAccount: 'cash' }),
    movement({ id: 'expense', date: '2026-02-05', kind: 'expense', amount: 12.5, account: 'cash' }),
    movement({ id: 'transfer', date: '2026-02-05', kind: 'transfer', amount: 20, account: 'cash', toAccount: 'bank' }),
    movement({ id: 'next-day', date: '2026-02-06', kind: 'expense', amount: 4, account: 'cash' }),
  ]);

  assert.deepEqual(totals, {
    '2026-02-05': { income: 100, expenses: 12.5, transfers: 1 },
    '2026-02-06': { income: 0, expenses: 4, transfers: 0 },
  });
});

test('debit balance sums every bank and ignores balances before an account start date', () => {
  const data = {
    ...state([
      movement({ id: 'legacy-income', kind: 'income', date: '2026-01-20', amount: 5, toAccount: 'bank' }),
      movement({ id: 'second-bank-before-open', kind: 'income', date: '2026-01-20', amount: 999, toAccount: 'bank-2' as AccountId }),
      movement({ id: 'second-bank-income', kind: 'income', date: '2026-02-10', amount: 20, toAccount: 'bank-2' as AccountId }),
      movement({ id: 'withdrawal', kind: 'transfer', amount: 10, account: 'bank', toAccount: 'cash' }),
    ], { cash: 20, bank: 30 }),
    accounts: [
      { id: 'cash', name: 'Efectivo', kind: 'cash', openingBalance: 20, startDate: '1900-01-01' },
      { id: 'bank', name: 'Banco principal', kind: 'bank', openingBalance: 30, startDate: '1900-01-01' },
      { id: 'bank-2', name: 'Banco secundario', kind: 'bank', openingBalance: 50, startDate: '2026-02-01' },
    ],
  } as FinanceState;

  const january = getMonthlySummary(data, '2026-01', 'all') as ReturnType<typeof getMonthlySummary> & { debitTotal: number };
  const february = getMonthlySummary(data, '2026-02', 'all') as ReturnType<typeof getMonthlySummary> & { debitTotal: number };

  assert.equal(january.balances.cash, 20);
  assert.equal(january.debitTotal, 35);
  assert.deepEqual(february.balances, { cash: 30, bank: 25, 'bank-2': 70 });
  assert.equal(february.debitTotal, 95);
  assert.equal(february.income, 20);
  assert.equal(february.expenses, 0);
});

test('account balance uses movements through the selected date', () => {
  const data = state([
    movement({ id: 'deposit', date: '2026-02-10', kind: 'income', amount: 50, toAccount: 'bank' }),
    movement({ id: 'withdrawal', date: '2026-02-15', kind: 'transfer', amount: 20, account: 'bank', toAccount: 'cash' }),
  ], { cash: 10, bank: 30 });

  assert.equal(getAccountBalanceAsOf(data, 'bank', '2026-02-09'), 30);
  assert.equal(getAccountBalanceAsOf(data, 'bank', '2026-02-10'), 80);
  assert.equal(getAccountBalanceAsOf(data, 'bank', '2026-02-15'), 60);
  assert.equal(getAccountBalanceAsOf(data, 'cash', '2026-02-14'), 10);
  assert.equal(getAccountBalanceAsOf(data, 'cash', '2026-02-15'), 30);
});

function state(movements: Movement[], opening: Record<AccountId, number> = { cash: 0, bank: 0 }): FinanceState {
  return {
    categories: [], movements, opening,
    accounts: [
      { id: 'cash', name: 'Efectivo', kind: 'cash', openingBalance: opening.cash ?? 0, startDate: '1900-01-01' },
      { id: 'bank', name: 'Banco / débito', kind: 'bank', openingBalance: opening.bank ?? 0, startDate: '1900-01-01' },
    ],
  };
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
