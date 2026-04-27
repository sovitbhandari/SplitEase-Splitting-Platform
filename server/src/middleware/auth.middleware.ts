import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { findUserById, toPublicUser } from '../models/user.model';

export function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  void (async () => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }
      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        res.status(401).json({ error: 'Missing access token' });
        return;
      }
      const payload = verifyAccessToken(token);
      const row = await findUserById(payload.sub);
      if (!row) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      req.user = toPublicUser(row);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired access token' });
    }
  })();
}
