import { query } from '../utils/db';

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  invite_code: string;
  created_by: string;
  created_at: Date;
  member_count: number;
};

export type GroupMember = {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: Date;
};

export async function createGroup(input: {
  name: string;
  description?: string;
  currency: string;
  created_by: string;
}): Promise<GroupSummary> {
  const { rows } = await query<GroupSummary>(
    `INSERT INTO groups (name, description, currency, created_by)
     VALUES ($1, $2, upper($3), $4)
     RETURNING id, name, description, currency, invite_code, created_by, created_at, 1::int AS member_count`,
    [input.name, input.description ?? null, input.currency, input.created_by]
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create group');
  }
  return row;
}

export async function addMember(input: {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
}): Promise<void> {
  await query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [input.group_id, input.user_id, input.role]
  );
}

export async function getGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const { rows } = await query<GroupSummary>(
    `SELECT
       g.id,
       g.name,
       g.description,
       g.currency,
       g.invite_code,
       g.created_by,
       g.created_at,
       COUNT(gm2.user_id)::int AS member_count
     FROM group_members gm
     INNER JOIN groups g ON g.id = gm.group_id
     INNER JOIN group_members gm2 ON gm2.group_id = g.id
     WHERE gm.user_id = $1
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getGroupByIdForUser(
  groupId: string,
  userId: string
): Promise<GroupSummary | null> {
  const { rows } = await query<GroupSummary>(
    `SELECT
       g.id,
       g.name,
       g.description,
       g.currency,
       g.invite_code,
       g.created_by,
       g.created_at,
       COUNT(gm2.user_id)::int AS member_count
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     INNER JOIN group_members gm2 ON gm2.group_id = g.id
     WHERE g.id = $1 AND gm.user_id = $2
     GROUP BY g.id`,
    [groupId, userId]
  );
  return rows[0] ?? null;
}

export async function getMembersByGroupId(groupId: string): Promise<GroupMember[]> {
  const { rows } = await query<GroupMember>(
    `SELECT
       gm.user_id,
       u.email,
       u.display_name,
       u.avatar_url,
       gm.role,
       gm.joined_at
     FROM group_members gm
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  return rows;
}

export async function findGroupByInviteCode(inviteCode: string): Promise<{
  id: string;
  invite_code: string;
} | null> {
  const { rows } = await query<{ id: string; invite_code: string }>(
    `SELECT id, invite_code FROM groups WHERE invite_code = $1 LIMIT 1`,
    [inviteCode]
  );
  return rows[0] ?? null;
}

export async function isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  const { rows } = await query<{ is_admin: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM group_members
      WHERE group_id = $1 AND user_id = $2 AND role = 'admin'
    ) AS is_admin`,
    [groupId, userId]
  );
  return Boolean(rows[0]?.is_admin);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await query(`DELETE FROM groups WHERE id = $1`, [groupId]);
}

export async function updateGroup(
  groupId: string,
  input: { name: string; description: string | null }
): Promise<GroupSummary | null> {
  const { rows } = await query<GroupSummary>(
    `UPDATE groups AS g
     SET name = $1, description = $2
     WHERE g.id = $3
     RETURNING
       g.id,
       g.name,
       g.description,
       g.currency,
       g.invite_code,
       g.created_by,
       g.created_at,
       (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count`,
    [input.name, input.description, groupId]
  );
  return rows[0] ?? null;
}
