import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { findUserById, toPublicUser } from '../models/user.model';

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const rawToken = socket.handshake.auth.token as string | undefined;
    if (!rawToken) {
      next(new Error('Authentication error'));
      return;
    }
    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length).trim()
      : rawToken;
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);
    if (!user) {
      next(new Error('Authentication error'));
      return;
    }
    socket.data.user = toPublicUser(user);
    next();
  } catch {
    next(new Error('Authentication error'));
  }
}
