import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './store/authStore';

let socketRef: Socket | null = null;

export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error('Missing access token');
  }
  if (!socketRef) {
    socketRef = io('http://localhost:4000', {
      autoConnect: false,
      auth: { token: `Bearer ${token}` },
    });
  } else {
    socketRef.auth = { token: `Bearer ${token}` };
  }
  return socketRef;
}
