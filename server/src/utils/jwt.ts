import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { loadEnv } from '../config/env';

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

export type AccessPayload = { sub: string; typ: 'access' };
export type RefreshPayload = { sub: string; jti: string; typ: 'refresh' };

export function signAccessToken(userId: string): string {
  const { JWT_SECRET } = loadEnv();
  const payload: AccessPayload = { sub: userId, typ: 'access' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(userId: string, jti: string): string {
  const { JWT_REFRESH_SECRET } = loadEnv();
  const payload: RefreshPayload = { sub: userId, jti, typ: 'refresh' };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): AccessPayload {
  const { JWT_SECRET } = loadEnv();
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid access token payload');
  }
  const rec = decoded as Record<string, unknown>;
  if (rec.typ !== 'access' || typeof rec.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return { sub: rec.sub, typ: 'access' };
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const { JWT_REFRESH_SECRET } = loadEnv();
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid refresh token payload');
  }
  const rec = decoded as Record<string, unknown>;
  if (
    rec.typ !== 'refresh' ||
    typeof rec.sub !== 'string' ||
    typeof rec.jti !== 'string'
  ) {
    throw new Error('Invalid refresh token');
  }
  return { sub: rec.sub, jti: rec.jti, typ: 'refresh' };
}

export function newRefreshJti(): string {
  return randomUUID();
}
