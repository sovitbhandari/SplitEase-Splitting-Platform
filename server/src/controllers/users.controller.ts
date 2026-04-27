import type { Request, Response } from 'express';

export function getMe(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.status(200).json({ user: req.user });
}
