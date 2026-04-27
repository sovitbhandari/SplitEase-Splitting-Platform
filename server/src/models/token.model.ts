import { query } from '../utils/db';

export async function insertRefreshToken(input: {
  jti: string;
  user_id: string;
  expires_at: Date;
}): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)`,
    [input.jti, input.user_id, input.expires_at]
  );
}

export async function findRefreshTokenByJti(jti: string): Promise<{
  jti: string;
  user_id: string;
  expires_at: Date;
} | null> {
  const { rows } = await query<{
    jti: string;
    user_id: string;
    expires_at: Date;
  }>(`SELECT jti, user_id, expires_at FROM refresh_tokens WHERE jti = $1 LIMIT 1`, [jti]);
  return rows[0] ?? null;
}

export async function deleteRefreshTokenByJti(jti: string): Promise<void> {
  await query(`DELETE FROM refresh_tokens WHERE jti = $1`, [jti]);
}
