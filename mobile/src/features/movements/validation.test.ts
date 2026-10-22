import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMovement, validateTransfer } from './validation.js';
import type { MovementDraft, TransferDraft } from './validation.js';

const validMovement: MovementDraft = {
  date: '2026-10-19',
  kind: 'expense',
  amount: '12.50',
  categoryId: 'food',
  account: 'cash',
  note: '',
};

const validTransfer: TransferDraft = {
  date: '2026-10-19',
  amount: '12.50',
  account: 'cash',
  toAccount: 'bank',
  note: '',
};

test('movement validation rejects zero and negative amounts', () => {
  assert.equal(validateMovement({ ...validMovement, amount: '0' }).ok, false);
  assert.equal(validateMovement({ ...validMovement, amount: '-1' }).ok, false);
});

test('movement validation rejects non-finite amounts', () => {
  assert.equal(validateMovement({ ...validMovement, amount: 'NaN' }).ok, false);
  assert.equal(validateMovement({ ...validMovement, amount: 'Infinity' }).ok, false);
});

test('movement validation rejects malformed and impossible dates', () => {
  assert.equal(validateMovement({ ...validMovement, date: '19-10-2026' }).ok, false);
  assert.equal(validateMovement({ ...validMovement, date: '2026-02-30' }).ok, false);
});

test('movement validation requires a category', () => {
  assert.deepEqual(validateMovement({ ...validMovement, categoryId: '  ' }), {
    ok: false,
    field: 'categoryId',
    message: 'Selecciona un rubro.',
  });
});

test('movement validation accepts a valid draft', () => {
  assert.deepEqual(validateMovement(validMovement), { ok: true });
});

test('transfer validation rejects same account, invalid amount, and invalid date', () => {
  assert.equal(validateTransfer({ ...validTransfer, toAccount: 'cash' }).ok, false);
  assert.equal(validateTransfer({ ...validTransfer, amount: 'Infinity' }).ok, false);
  assert.equal(validateTransfer({ ...validTransfer, date: '2026-13-01' }).ok, false);
});

test('transfer validation accepts a valid draft', () => {
  assert.deepEqual(validateTransfer(validTransfer), { ok: true });
});

test('transfer validation blocks amounts above available balance', () => {
  assert.deepEqual(validateTransfer(validTransfer, 12.49), {
    ok: false,
    field: 'amount',
    message: 'Saldo insuficiente. Disponible: 12.49.',
  });
  assert.deepEqual(validateTransfer(validTransfer, 12.5), { ok: true });
});
