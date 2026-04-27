import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env';
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schema';
import {
  createUser,
  findUserByEmail,
  toPublicUser,
} from '../models/user.model';
import {
  deleteRefreshTokenByJti,
  findRefreshTokenByJti,
  insertRefreshToken,
} from '../models/token.model';
import {
  newRefreshJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';

const REFRESH_COOKIE = 'refreshToken';
const BCRYPT_ROUNDS = 12;

function refreshCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
} {
  const env = loadEnv();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function refreshExpiryFromJwt(token: string): Date {
  const dec = jwt.decode(token);
  if (
    dec === null ||
    typeof dec === 'string' ||
    typeof dec !== 'object' ||
    !('exp' in dec) ||
    typeof dec.exp !== 'number'
  ) {
    throw new Error('Invalid refresh token shape');
  }
  return new Date(dec.exp * 1000);
}

async function issueSession(
  res: Response,
  userId: string
): Promise<{ accessToken: string }> {
  const jti = newRefreshJti();
  const refreshToken = signRefreshToken(userId, jti);
  const expiresAt = refreshExpiryFromJwt(refreshToken);
  await insertRefreshToken({ jti, user_id: userId, expires_at: expiresAt });
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return { accessToken: signAccessToken(userId) };
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password, display_name } = parsed.data;
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const user = await createUser({ email, password_hash, display_name });
    const { accessToken } = await issueSession(res, user.id);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const row = await findUserByEmail(email);
  if (!row) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const user = toPublicUser(row);
  const { accessToken } = await issueSession(res, user.id);
  res.status(200).json({ user, accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }
  const stored = await findRefreshTokenByJti(payload.jti);
  if (!stored) {
    res.status(401).json({ error: 'Refresh token revoked or unknown' });
    return;
  }
  if (stored.expires_at.getTime() < Date.now()) {
    await deleteRefreshTokenByJti(payload.jti);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.status(401).json({ error: 'Refresh token expired' });
    return;
  }
  await deleteRefreshTokenByJti(payload.jti);
  const { accessToken } = await issueSession(res, payload.sub);
  res.status(200).json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await deleteRefreshTokenByJti(payload.jti);
    } catch {
      // ignore invalid token on logout
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.status(204).send();
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
