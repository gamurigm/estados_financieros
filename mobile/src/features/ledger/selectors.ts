import type { AccountId, FinanceState, Movement } from '../../api/contracts';

export type MonthlySummary = {
  income: number;
  expenses: number;
  net: number;
  balances: Record<AccountId, number>;
  debitTotal: number;
  movements: Movement[];
};

export function getMonthlySummary(
  state: FinanceState,
  month: string,
  filter: 'all' | AccountId,
): MonthlySummary {
  const monthEnd = getMonthEnd(month);
  const movements = state.movements.filter((movement) => (
    movement.date >= `${month}-01`
    && movement.date <= monthEnd
    && matchesAccount(movement, filter)
  ));
  const income = movements
    .filter((movement) => movement.kind === 'income')
    .reduce((sum, movement) => sum + movement.amount, 0);
  const expenses = movements
    .filter((movement) => movement.kind === 'expense')
    .reduce((sum, movement) => sum + movement.amount, 0);

  const balances = Object.fromEntries(state.accounts.map((account) => [
    account.id,
    getAccountBalanceAsOf(state, account.id, monthEnd),
  ]));

  return {
    income,
    expenses,
    net: income - expenses,
    balances,
    debitTotal: state.accounts
      .filter((account) => account.kind === 'bank')
      .reduce((total, account) => total + balances[account.id], 0),
    movements,
  };
}

function getMonthEnd(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error('El mes debe tener formato AAAA-MM.');
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

function matchesAccount(movement: Movement, filter: 'all' | AccountId) {
  if (filter === 'all') return true;
  if (movement.kind === 'income') return movement.toAccount === filter;
  if (movement.kind === 'expense') return movement.account === filter;
  return movement.account === filter || movement.toAccount === filter;
}

export function getAccountBalanceAsOf(state: Pick<FinanceState, 'accounts' | 'movements'>, account: AccountId, asOfDate: string) {
  const accountRecord = state.accounts.find((item) => item.id === account);
  if (!accountRecord || !isCalendarDate(asOfDate) || asOfDate < accountRecord.startDate) return 0;
  return state.movements.reduce((balance, movement) => {
    if (movement.date < accountRecord.startDate || movement.date > asOfDate) return balance;
    if (movement.kind === 'income' && movement.toAccount === account) return balance + movement.amount;
    if (movement.kind === 'expense' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.toAccount === account) return balance + movement.amount;
    return balance;
  }, accountRecord.openingBalance);
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
