import type { FinanceState, Movement } from '../../api';

export type MonthlyTrendPoint = { month: string; income: number; expenses: number };
export type ExpenseCategoryTotal = { categoryId: string; name: string; amount: number };
export type BudgetProgress = { spent: number; remaining: number; percent: number; barPercent: number };
export type AccountBalance = { id: string; name: string; kind: 'cash' | 'bank'; amount: number };
export type BalanceSheetReport = { asOfDate: string; accounts: AccountBalance[]; total: number };
export type CashFlowReport = {
  startDate: string;
  endDate: string;
  openingBalance: number;
  income: number;
  expenses: number;
  netFlow: number;
  closingBalance: number;
  movements: Movement[];
};

export function getBalanceSheet(state: Pick<FinanceState, 'accounts' | 'movements'>, asOfDate: string): BalanceSheetReport | null {
  if (!isValidDate(asOfDate)) return null;
  const accounts = state.accounts
    .filter((account) => account.startDate <= asOfDate)
    .map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      amount: getAccountBalance(state, account.id, asOfDate),
    }));
  return { asOfDate, accounts, total: roundCurrency(accounts.reduce((sum, account) => sum + account.amount, 0)) };
}

export function getCashFlow(state: Pick<FinanceState, 'accounts' | 'movements'>, startDate: string, endDate: string): CashFlowReport | null {
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) return null;
  const movements = state.movements
    .filter((movement) => movement.kind !== 'transfer' && movement.date >= startDate && movement.date <= endDate)
    .sort((left, right) => right.date.localeCompare(left.date));
  const income = roundCurrency(movements.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0));
  const expenses = roundCurrency(movements.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0));
  return {
    startDate,
    endDate,
    openingBalance: getTotalAccountBalance(state, previousDate(startDate)),
    income,
    expenses,
    netFlow: roundCurrency(income - expenses),
    closingBalance: getTotalAccountBalance(state, endDate),
    movements,
  };
}

export function getMonthlyTrend(state: Pick<FinanceState, 'movements'>, endMonth: string): MonthlyTrendPoint[] {
  return Array.from({ length: 6 }, (_, index) => moveMonth(endMonth, index - 5)).map((month) => {
    const movements = state.movements.filter((movement) => movement.date.startsWith(`${month}-`));
    return {
      month,
      income: roundCurrency(movements.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0)),
      expenses: roundCurrency(movements.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0)),
    };
  });
}

export function getExpenseCategoryBreakdown(state: Pick<FinanceState, 'categories' | 'movements'>, month: string): ExpenseCategoryTotal[] {
  const categoryNames = new Map(state.categories.filter((category) => category.kind === 'expense').map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();
  for (const movement of state.movements) {
    if (movement.kind !== 'expense' || !movement.date.startsWith(`${month}-`) || !movement.categoryId) continue;
    totals.set(movement.categoryId, (totals.get(movement.categoryId) ?? 0) + movement.amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, name: categoryNames.get(categoryId) ?? 'Rubro', amount: roundCurrency(amount) }))
    .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name, 'es'));
}

export function getBudgetProgress(budget: number, spent: number): BudgetProgress {
  const percent = Math.round((spent / budget) * 1000) / 10;
  return { spent: roundCurrency(spent), remaining: roundCurrency(budget - spent), percent, barPercent: Math.min(100, Math.max(0, percent)) };
}

function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getTotalAccountBalance(state: Pick<FinanceState, 'accounts' | 'movements'>, date: string) {
  return roundCurrency(state.accounts.reduce((total, account) => total + getAccountBalance(state, account.id, date), 0));
}

function getAccountBalance(state: Pick<FinanceState, 'accounts' | 'movements'>, accountId: string, date: string) {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account || date < account.startDate) return 0;
  return roundCurrency(state.movements.reduce((balance, movement) => {
    if (movement.date < account.startDate || movement.date > date) return balance;
    if (movement.kind === 'income' && movement.toAccount === accountId) return balance + movement.amount;
    if (movement.kind === 'expense' && movement.account === accountId) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.account === accountId) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.toAccount === accountId) return balance + movement.amount;
    return balance;
  }, account.openingBalance));
}

function previousDate(date: string) {
  const previous = new Date(`${date}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
