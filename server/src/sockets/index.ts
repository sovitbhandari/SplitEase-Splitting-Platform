import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { loadEnv } from '../config/env';
import { socketAuthMiddleware } from './authMiddleware';
import { registerGroupHandlers } from './groupHandlers';
import { setSocketServer } from './balanceEmitter';

export function attachSocketIO(httpServer: HttpServer): Server {
  const env = loadEnv();
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    void socketAuthMiddleware(socket, next);
  });

  io.on('connection', (socket) => {
    registerGroupHandlers(socket);
  });

  setSocketServer(io);
  return io;
}
