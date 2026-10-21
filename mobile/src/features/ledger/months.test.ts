import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonth } from './months.js';

test('month navigation crosses year and leap-year boundaries', () => {
  assert.equal(moveMonth('2026-01', -1), '2025-12');
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2024-02', 1), '2024-03');
});

test('month navigation rejects malformed months', () => {
  assert.throws(() => moveMonth('2026-13', 1), /AAAA-MM/);
});
