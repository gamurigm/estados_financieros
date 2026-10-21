const maxBudgetAmount = 999_999_999_999.99;

export function parseBudgetAmount(input: string) {
  const value = input.trim();
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 && amount <= maxBudgetAmount ? amount : null;
}
