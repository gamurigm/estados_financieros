export type Kind = 'income' | 'expense' | 'transfer';
export type AccountId = 'cash' | 'bank';
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
  opening: Record<AccountId, number>;
};
