import type { AccountId, FinanceState, Movement } from '../../api/contracts';

export type MonthlySummary = {
  income: number;
  expenses: number;
  net: number;
  balances: Record<AccountId, number>;
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

  return {
    income,
    expenses,
    net: income - expenses,
    balances: {
      cash: getAccountBalance(state, 'cash', monthEnd),
      bank: getAccountBalance(state, 'bank', monthEnd),
    },
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

function getAccountBalance(state: FinanceState, account: AccountId, monthEnd: string) {
  return state.movements.reduce((balance, movement) => {
    if (movement.date > monthEnd) return balance;
    if (movement.kind === 'income' && movement.toAccount === account) return balance + movement.amount;
    if (movement.kind === 'expense' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.account === account) return balance - movement.amount;
    if (movement.kind === 'transfer' && movement.toAccount === account) return balance + movement.amount;
    return balance;
  }, state.opening[account] ?? 0);
}
