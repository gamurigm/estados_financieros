import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBudgetAmount } from './validation.js';

test('budget amount accepts positive values with dot or comma decimals', () => {
  assert.equal(parseBudgetAmount('250.50'), 250.5);
  assert.equal(parseBudgetAmount('0,75'), 0.75);
});

test('budget amount rejects zero, negatives, excess decimals, and grouped values', () => {
  for (const input of ['', '0', '-1', '1.001', '1,234.50', '1000000000000']) {
    assert.equal(parseBudgetAmount(input), null, input);
  }
});
