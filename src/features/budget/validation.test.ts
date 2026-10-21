import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBudgetAmount } from './validation';

test('budget amount accepts comma and dot decimals', () => {
  assert.equal(parseBudgetAmount('450,25'), 450.25);
  assert.equal(parseBudgetAmount(' 450.25 '), 450.25);
});

test('budget amount rejects invalid precision and non-positive values', () => {
  for (const value of ['', '0', '-1', '1.234', '1,234', '1000000000000']) {
    assert.equal(parseBudgetAmount(value), null, value);
  }
});
