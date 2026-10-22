import assert from 'node:assert/strict';
import test from 'node:test';
import { getCalendarWeeks, moveMonth } from './months.js';

test('month navigation crosses year and leap-year boundaries', () => {
  assert.equal(moveMonth('2026-01', -1), '2025-12');
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2024-02', 1), '2024-03');
});

test('month navigation rejects malformed months', () => {
  assert.throws(() => moveMonth('2026-13', 1), /AAAA-MM/);
});

test('calendar weeks start on Monday and include leap day once', () => {
  const weeks = getCalendarWeeks('2024-02');

  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0], [null, null, null, '2024-02-01', '2024-02-02', '2024-02-03', '2024-02-04']);
  assert.equal(weeks[4][3], '2024-02-29');
  assert.equal(weeks.flat().filter((date) => date === '2024-02-29').length, 1);
});
