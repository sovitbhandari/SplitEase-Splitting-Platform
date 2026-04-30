import { api } from './axios';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count: number;
};

export type GroupMember = {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
};

export async function getGroups(): Promise<Group[]> {
  const { data } = await api.get<{ groups: Group[] }>('/api/groups');
  return data.groups;
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  currency?: string;
}): Promise<Group> {
  const { data } = await api.post<{ group: Group }>('/api/groups', payload);
  return data.group;
}

export async function joinGroup(inviteCode: string): Promise<Group> {
  const { data } = await api.post<{ group: Group }>('/api/groups/join', {
    invite_code: inviteCode,
  });
  return data.group;
}

export async function getGroupById(groupId: string): Promise<{
  group: Group;
  members: GroupMember[];
}> {
  const { data } = await api.get<{ group: Group; members: GroupMember[] }>(
    `/api/groups/${groupId}`
  );
  return data;
}
