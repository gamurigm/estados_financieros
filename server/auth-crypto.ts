import argon2 from 'argon2';
import type { Pool } from 'pg';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function createOwner(pool: Pool, username: string, password: string): Promise<void> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) throw new Error('El usuario y la contraseña son obligatorios.');

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO owner_credentials (singleton, username, password_hash)
     VALUES (true, $1, $2)
     ON CONFLICT (singleton) DO NOTHING
     RETURNING singleton`,
    [normalizedUsername, passwordHash],
  );

  if (result.rowCount !== 1) throw new Error('El propietario ya existe.');
}
