import { query } from '../utils/db';

export type GroupAccessDecision =
  | {
      ok: true;
      groupId: string;
      userId: string;
      role: 'admin' | 'member';
      isCurrentMember: true;
      isHistoricalMember: true;
    }
  | {
      ok: false;
      status: 400 | 404;
      error: 'Invalid group id' | 'Group not found';
      groupId: string;
      userId: string;
    };

export type HistoricalParticipantDecision =
  | {
      ok: true;
      groupId: string;
      userId: string;
      isCurrentMember: boolean;
      isHistoricalMember: true;
    }
  | {
      ok: false;
      status: 400 | 403;
      error: string;
      groupId: string;
      userId: string;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function requireCurrentGroupMember(
  groupId: string,
  userId: string
): Promise<GroupAccessDecision> {
  if (!isUuid(groupId)) {
    return { ok: false, status: 400, error: 'Invalid group id', groupId, userId };
  }
  const { rows } = await query<{ role: 'admin' | 'member' }>(
    `SELECT role
     FROM group_members
     WHERE group_id = $1
       AND user_id = $2
       AND removed_at IS NULL`,
    [groupId, userId]
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, status: 404, error: 'Group not found', groupId, userId };
  }
  return {
    ok: true,
    groupId,
    userId,
    role: row.role,
    isCurrentMember: true,
    isHistoricalMember: true,
  };
}

export async function requireCurrentGroupAdmin(
  groupId: string,
  userId: string
): Promise<GroupAccessDecision | { ok: false; status: 403; error: 'Forbidden' }> {
  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    return access;
  }
  if (access.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return access;
}

export async function requireHistoricalGroupParticipant(
  groupId: string,
  userId: string
): Promise<HistoricalParticipantDecision> {
  if (!isUuid(groupId)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid group id',
      groupId,
      userId,
    };
  }
  const { rows } = await query<{ removed_at: Date | null }>(
    `SELECT removed_at
     FROM group_members
     WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      status: 403,
      error: 'User is not a participant in this group.',
      groupId,
      userId,
    };
  }
  return {
    ok: true,
    groupId,
    userId,
    isCurrentMember: row.removed_at === null,
    isHistoricalMember: true,
  };
}

export async function listCurrentGroupMemberIds(groupId: string): Promise<Set<string>> {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id
     FROM group_members
     WHERE group_id = $1
       AND removed_at IS NULL`,
    [groupId]
  );
  return new Set(rows.map((row) => row.user_id));
}

export async function listHistoricalGroupParticipantIds(groupId: string): Promise<Set<string>> {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId]
  );
  return new Set(rows.map((row) => row.user_id));
}

export async function softRemoveGroupMember(input: {
  groupId: string;
  userId: string;
}): Promise<boolean> {
  const result = await query(
    `UPDATE group_members
     SET removed_at = COALESCE(removed_at, now())
     WHERE group_id = $1 AND user_id = $2`,
    [input.groupId, input.userId]
  );
  return result.rowCount > 0;
}
