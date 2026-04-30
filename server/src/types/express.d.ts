declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        display_name: string;
        avatar_url: string | null;
      };
    }
  }
}

export {};

declare module 'socket.io' {
  interface SocketData {
    user?: {
      id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
    };
  }
}
