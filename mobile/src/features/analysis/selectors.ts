import type { FinanceState } from '../../api/contracts';
import { moveMonth } from '../ledger/months';

export type MonthlyTrendPoint = { month: string; income: number; expenses: number };
export type ExpenseCategoryTotal = { categoryId: string; name: string; amount: number };
export type BudgetProgress = { spent: number; remaining: number; percent: number; barPercent: number };

export function getMonthlyTrend(state: FinanceState, endMonth: string): MonthlyTrendPoint[] {
  return Array.from({ length: 6 }, (_, index) => moveMonth(endMonth, index - 5)).map((month) => {
    const movements = state.movements.filter((movement) => movement.date.startsWith(`${month}-`));
    return {
      month,
      income: roundCurrency(movements.filter((movement) => movement.kind === 'income').reduce((sum, movement) => sum + movement.amount, 0)),
      expenses: roundCurrency(movements.filter((movement) => movement.kind === 'expense').reduce((sum, movement) => sum + movement.amount, 0)),
    };
  });
}

export function getExpenseCategoryBreakdown(state: FinanceState, month: string): ExpenseCategoryTotal[] {
  moveMonth(month, 0);
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
  return {
    spent: roundCurrency(spent),
    remaining: roundCurrency(budget - spent),
    percent,
    barPercent: Math.min(100, Math.max(0, percent)),
  };
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
