import type { Socket } from 'socket.io';

function roomName(groupId: string): string {
  return `group:${groupId}`;
}

export function registerGroupHandlers(socket: Socket): void {
  socket.on('join_group', (groupId: string) => {
    if (!groupId) {
      return;
    }
    socket.join(roomName(groupId));
  });

  socket.on('leave_group', (groupId: string) => {
    if (!groupId) {
      return;
    }
    socket.leave(roomName(groupId));
  });
}

export { roomName };
