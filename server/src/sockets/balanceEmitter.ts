import type { Server as SocketIOServer } from 'socket.io';
import type { BalanceEntry } from '../utils/balanceEngine';
import { revalidateGroupRoomMembers, roomName } from './groupHandlers';

let ioRef: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioRef = io;
}

export async function emitBalanceUpdateToGroup(
  groupId: string,
  updatedBalances: BalanceEntry[]
): Promise<void> {
  if (!ioRef) {
    return;
  }
  await revalidateGroupRoomMembers(ioRef, groupId);
  ioRef.to(roomName(groupId)).emit('balance_updated', {
    groupId,
    updatedBalances,
  });
}

export async function emitGroupMembersUpdated(groupId: string): Promise<void> {
  if (!ioRef) {
    return;
  }
  await revalidateGroupRoomMembers(ioRef, groupId);
  ioRef.to(roomName(groupId)).emit('group_members_updated', { groupId });
}

export async function emitGroupDataUpdated(groupId: string): Promise<void> {
  if (!ioRef) {
    return;
  }
  await revalidateGroupRoomMembers(ioRef, groupId);
  ioRef.to(roomName(groupId)).emit('group_data_updated', { groupId });
}
