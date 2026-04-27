import type { NextFunction, Request, Response } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = typeof (err as { status?: number }).status === 'number'
    ? (err as { status: number }).status
    : 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}
