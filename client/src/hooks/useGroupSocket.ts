import { useEffect } from 'react';
import type { BalanceEntry } from '../api/expenses';
import { getSocket } from '../socket';
import { useBalanceStore } from '../store/balanceStore';

type BalanceUpdatePayload = {
  groupId: string;
  updatedBalances: BalanceEntry[];
};

type GroupMembersUpdatedPayload = {
  groupId: string;
};

type GroupDataUpdatedPayload = {
  groupId: string;
};

export function useGroupSocket(
  groupId: string,
  onMembersUpdated?: () => void,
  onDataUpdated?: () => void
): void {
  const setBalances = useBalanceStore((state) => state.setBalances);

  useEffect(() => {
    if (!groupId) {
      return;
    }
    let mounted = true;
    const socket = getSocket();
    const onBalanceUpdated = (payload: BalanceUpdatePayload): void => {
      if (mounted && payload.groupId === groupId) {
        setBalances(payload.updatedBalances);
      }
    };
    const onGroupMembersUpdated = (payload: GroupMembersUpdatedPayload): void => {
      if (mounted && payload.groupId === groupId) {
        onMembersUpdated?.();
      }
    };
    const onGroupDataUpdated = (payload: GroupDataUpdatedPayload): void => {
      if (mounted && payload.groupId === groupId) {
        onDataUpdated?.();
      }
    };

    socket.on('balance_updated', onBalanceUpdated);
    socket.on('group_members_updated', onGroupMembersUpdated);
    socket.on('group_data_updated', onGroupDataUpdated);
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join_group', groupId);

    return () => {
      mounted = false;
      socket.emit('leave_group', groupId);
      socket.off('balance_updated', onBalanceUpdated);
      socket.off('group_members_updated', onGroupMembersUpdated);
      socket.off('group_data_updated', onGroupDataUpdated);
      socket.disconnect();
    };
  }, [groupId, onDataUpdated, onMembersUpdated, setBalances]);
}
