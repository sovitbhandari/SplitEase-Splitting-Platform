import type { Socket } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { requireCurrentGroupMember } from '../models/groupAccess.model';

function roomName(groupId: string): string {
  return `group:${groupId}`;
}

const groupRoomPayloadSchema = z.union([
  z.string().uuid(),
  z.object({ groupId: z.string().uuid() }).transform((value) => value.groupId),
]);

type GroupAck = (response: { ok: true } | { ok: false; error: string }) => void;

function acknowledge(ack: unknown, response: { ok: true } | { ok: false; error: string }): void {
  if (typeof ack === 'function') {
    (ack as GroupAck)(response);
  }
}

async function canJoinGroup(socket: Socket, groupId: string): Promise<boolean> {
  const userId = socket.data.user?.id;
  if (!userId) {
    return false;
  }
  const access = await requireCurrentGroupMember(groupId, userId);
  return access.ok;
}

export function registerGroupHandlers(socket: Socket): void {
  socket.on('join_group', (payload: unknown, ack?: unknown) => {
    void (async () => {
      const parsed = groupRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge(ack, { ok: false, error: 'Invalid group id' });
        return;
      }
      const groupId = parsed.data;
      const allowed = await canJoinGroup(socket, groupId);
      if (!allowed) {
        socket.leave(roomName(groupId));
        acknowledge(ack, { ok: false, error: 'Group not found' });
        return;
      }
      await socket.join(roomName(groupId));
      acknowledge(ack, { ok: true });
    })().catch(() => {
      acknowledge(ack, { ok: false, error: 'Unable to join group' });
    });
  });

  socket.on('leave_group', (payload: unknown, ack?: unknown) => {
    const parsed = groupRoomPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      acknowledge(ack, { ok: false, error: 'Invalid group id' });
      return;
    }
    const groupId = parsed.data;
    socket.leave(roomName(groupId));
    acknowledge(ack, { ok: true });
  });
}

export async function revalidateGroupRoomMembers(
  io: SocketIOServer,
  groupId: string
): Promise<void> {
  const room = io.sockets.adapter.rooms.get(roomName(groupId));
  if (!room) {
    return;
  }
  await Promise.all(
    Array.from(room).map(async (socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        return;
      }
      const allowed = await canJoinGroup(socket, groupId);
      if (!allowed) {
        socket.leave(roomName(groupId));
        socket.emit('group_access_revoked', { groupId });
      }
    })
  );
}

export { roomName };
