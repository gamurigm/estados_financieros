export type Kind = 'income' | 'expense' | 'transfer';
export type AccountId = string;
export type Account = { id: AccountId; name: string; kind: 'cash' | 'bank'; openingBalance: number; startDate: string };
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
export type FinanceState = {
  categories: Category[];
  movements: Movement[];
  accounts: Account[];
  opening: Record<string, number>;
};
