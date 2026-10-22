import type { AccountId } from '../../api/contracts';

export type MovementDraft = {
  id?: string;
  date: string;
  kind: 'income' | 'expense';
  amount: string;
  categoryId: string;
  account: AccountId;
  note: string;
};

export type TransferDraft = {
  date: string;
  amount: string;
  account: AccountId;
  toAccount: AccountId;
  note: string;
};

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string };

export function validateMovement(input: MovementDraft): ValidationResult {
  const shared = validateDateAndAmount(input.date, input.amount);
  if (!shared.ok) return shared;
  if (!input.categoryId.trim()) {
    return { ok: false, field: 'categoryId', message: 'Selecciona un rubro.' };
  }
  return { ok: true };
}

export function validateTransfer(input: TransferDraft, availableBalance?: number): ValidationResult {
  const shared = validateDateAndAmount(input.date, input.amount);
  if (!shared.ok) return shared;
  if (input.account === input.toAccount) {
    return { ok: false, field: 'toAccount', message: 'Elige cuentas distintas.' };
  }
  if (availableBalance !== undefined && Math.round(parseAmount(input.amount) * 100) > Math.round(availableBalance * 100)) {
    return { ok: false, field: 'amount', message: `Saldo insuficiente. Disponible: ${availableBalance.toFixed(2)}.` };
  }
  return { ok: true };
}

export function parseAmount(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function validateDateAndAmount(date: string, amount: string): ValidationResult {
  if (!isCalendarDate(date)) {
    return { ok: false, field: 'date', message: 'Ingresa una fecha válida.' };
  }
  const numericAmount = parseAmount(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, field: 'amount', message: 'Ingresa un monto mayor que cero.' };
  }
  return { ok: true };
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
