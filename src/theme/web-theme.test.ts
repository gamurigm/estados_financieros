import assert from 'node:assert/strict';
import test from 'node:test';
import { themeFromStorage } from './web-theme';

test('restores only a saved light theme and defaults all other values to dark', () => {
  assert.equal(themeFromStorage('light'), 'light');
  assert.equal(themeFromStorage('dark'), 'dark');
  assert.equal(themeFromStorage(null), 'dark');
  assert.equal(themeFromStorage('invalid'), 'dark');
});
