import type { Pool } from 'pg';

export type NewSession = {
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
};

export interface AuthStore {
  findOwner(username: string): Promise<{ username: string; passwordHash: string } | null>;
  createSession(session: NewSession): Promise<void>;
  findActiveAccessToken(tokenHash: string, now: Date): Promise<{ id: string } | null>;
  rotateRefreshToken(currentHash: string, next: NewSession, now: Date): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, now: Date): Promise<void>;
}

export class PgAuthStore implements AuthStore {
  constructor(private readonly pool: Pool) {}

  async findOwner(username: string) {
    const result = await this.pool.query<{ username: string; password_hash: string }>(
      'SELECT username, password_hash FROM owner_credentials WHERE username = $1',
      [username],
    );
    const owner = result.rows[0];
    return owner ? { username: owner.username, passwordHash: owner.password_hash } : null;
  }

  async createSession(session: NewSession) {
    await this.pool.query(
      `INSERT INTO auth_sessions (access_token_hash, access_expires_at, refresh_token_hash, refresh_expires_at)
       VALUES ($1, $2, $3, $4)`,
      [session.accessTokenHash, session.accessExpiresAt, session.refreshTokenHash, session.refreshExpiresAt],
    );
  }

  async findActiveAccessToken(tokenHash: string, now: Date) {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM auth_sessions
       WHERE access_token_hash = $1 AND access_expires_at > $2 AND refresh_expires_at > $2`,
      [tokenHash, now],
    );
    return result.rows[0] ?? null;
  }

  async rotateRefreshToken(currentHash: string, next: NewSession, now: Date) {
    const result = await this.pool.query(
      `UPDATE auth_sessions
       SET access_token_hash = $1, access_expires_at = $2,
           refresh_token_hash = $3, refresh_expires_at = $4
       WHERE refresh_token_hash = $5 AND refresh_expires_at > $6`,
      [next.accessTokenHash, next.accessExpiresAt, next.refreshTokenHash, next.refreshExpiresAt, currentHash, now],
    );
    return result.rowCount === 1;
  }

  async revokeRefreshToken(tokenHash: string, _now: Date) {
    await this.pool.query('DELETE FROM auth_sessions WHERE refresh_token_hash = $1', [tokenHash]);
  }
}
