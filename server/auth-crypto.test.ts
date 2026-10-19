import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { createOwner, hashPassword, verifyPassword } from './auth-crypto.js';

test('hashPassword creates a verifiable Argon2id hash', async () => {
  const password = 'correct horse battery staple';
  const hash = await hashPassword(password);

  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(password, hash), true);
});

test('verifyPassword rejects a different password', async () => {
  const hash = await hashPassword('correct horse battery staple');

  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('verifyPassword rejects a malformed stored hash', async () => {
  assert.equal(await verifyPassword('any password', 'not-an-argon2-hash'), false);
});

test('createOwner rejects a second owner', async () => {
  let inserts = 0;
  const pool = {
    query: async () => {
      inserts += 1;
      return { rowCount: 0 };
    },
  } as unknown as Pool;

  await assert.rejects(createOwner(pool, 'owner', 'password'), /propietario ya existe/i);
  assert.equal(inserts, 1);
});
