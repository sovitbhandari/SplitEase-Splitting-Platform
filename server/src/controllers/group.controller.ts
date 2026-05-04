import type { Request, Response } from 'express';
import {
  addMember,
  createGroup,
  deleteGroup,
  findGroupByInviteCode,
  getGroupByIdForUser,
  getGroupsForUser,
  getMembersByGroupId,
  isGroupAdmin,
  updateGroup,
} from '../models/group.model';
import {
  createGroupBodySchema,
  joinGroupBodySchema,
  updateGroupBodySchema,
} from '../schemas/group.schema';
import { emitGroupMembersUpdated } from '../sockets/balanceEmitter';

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

export async function createGroupHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const parsed = createGroupBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const group = await createGroup({
    name: parsed.data.name,
    description: parsed.data.description,
    currency: parsed.data.currency,
    created_by: userId,
  });
  await addMember({ group_id: group.id, user_id: userId, role: 'admin' });
  res.status(201).json({ group });
}

export async function getMyGroupsHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const groups = await getGroupsForUser(userId);
  res.status(200).json({ groups });
}

export async function updateGroupHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.id;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const parsed = updateGroupBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const membership = await getGroupByIdForUser(groupId, userId);
  if (!membership) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  const admin = await isGroupAdmin(groupId, userId);
  if (!admin) {
    res.status(403).json({ error: 'Only admins can update trip settings' });
    return;
  }
  const nextDescription =
    parsed.data.description !== undefined
      ? parsed.data.description.trim() || null
      : membership.description;
  const updated = await updateGroup(groupId, {
    name: parsed.data.name.trim(),
    description: nextDescription,
  });
  if (!updated) {
    res.status(500).json({ error: 'Failed to update group' });
    return;
  }
  res.status(200).json({ group: updated });
}

export async function getGroupByIdHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.id;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const group = await getGroupByIdForUser(groupId, userId);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  const members = await getMembersByGroupId(group.id);
  res.status(200).json({ group, members });
}

export async function joinGroupHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const parsed = joinGroupBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const found = await findGroupByInviteCode(parsed.data.invite_code);
  if (!found) {
    res.status(404).json({ error: 'Invalid invite code' });
    return;
  }
  await addMember({ group_id: found.id, user_id: userId, role: 'member' });
  await emitGroupMembersUpdated(found.id);
  const group = await getGroupByIdForUser(found.id, userId);
  if (!group) {
    res.status(500).json({ error: 'Failed to join group' });
    return;
  }
  res.status(200).json({ group });
}

export async function deleteGroupHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.id;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const membership = await getGroupByIdForUser(groupId, userId);
  if (!membership) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  const admin = await isGroupAdmin(groupId, userId);
  if (!admin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await deleteGroup(groupId);
  res.status(204).send();
}
