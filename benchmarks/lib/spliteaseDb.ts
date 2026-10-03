import request from 'supertest';
import { Pool, type PoolClient } from 'pg';
import { createApp } from '../../server/src/app';

export type BenchUser = {
  userId: string;
  token: string;
  email: string;
};

export type BenchGroup = {
  groupId: string;
  inviteCode: string;
  users: BenchUser[];
};

let appInstance: ReturnType<typeof createApp> | null = null;

export function getBenchApp(): ReturnType<typeof createApp> {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance;
}

async function deleteIfPresent(client: PoolClient, table: string): Promise<void> {
  try {
    await client.query(`DELETE FROM ${table}`);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '42P01'
    ) {
      return;
    }
    throw error;
  }
}

export async function resetSplitEaseData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'on', false)`);
    await client.query('BEGIN');
    await deleteIfPresent(client, 'provider_webhook_events');
    await deleteIfPresent(client, 'balance_update_outbox');
    await deleteIfPresent(client, 'idempotency_records');
    await deleteIfPresent(client, 'payment_transfers');
    await client.query('DELETE FROM settlements');
    await client.query('DELETE FROM expense_splits');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM ledger_entries');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM plaid_items');
    await client.query('DELETE FROM group_members');
    await client.query('DELETE FROM groups');
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM email_verifications');
    await client.query('DELETE FROM users');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'off', false)`).catch(() => undefined);
    client.release();
  }
}

export async function registerBenchUser(email: string, displayName: string): Promise<BenchUser> {
  const response = await request(getBenchApp())
    .post('/api/auth/register')
    .send({ email, password: 'password123', display_name: displayName })
    .expect(201);
  return {
    userId: response.body.user.id as string,
    token: response.body.accessToken as string,
    email,
  };
}

export async function createBenchGroup(input: {
  label: string;
  memberCount: number;
}): Promise<BenchGroup> {
  const users: BenchUser[] = [];
  for (let i = 0; i < input.memberCount; i += 1) {
    users.push(await registerBenchUser(`${input.label}-${i}@bench.local`, `${input.label} ${i}`));
  }
  const owner = users[0];
  if (!owner) throw new Error('memberCount must be positive');
  const group = await request(getBenchApp())
    .post('/api/groups')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: `Bench ${input.label}`, description: 'synthetic benchmark group', currency: 'USD' })
    .expect(201);
  const groupId = group.body.group.id as string;
  const inviteCode = group.body.group.invite_code as string;
  for (const user of users.slice(1)) {
    await request(getBenchApp())
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ invite_code: inviteCode })
      .expect(200);
  }
  return { groupId, inviteCode, users };
}

export async function createEqualExpense(input: {
  group: BenchGroup;
  payerIndex: number;
  amount: string;
  description: string;
}): Promise<string> {
  const payer = input.group.users[input.payerIndex % input.group.users.length];
  if (!payer) throw new Error('payer not found');
  const response = await request(getBenchApp())
    .post(`/api/groups/${input.group.groupId}/expenses`)
    .set('Authorization', `Bearer ${payer.token}`)
    .send({
      amount: input.amount,
      description: input.description,
      category: 'other',
      date: '2026-10-02',
      paidBy: payer.userId,
      splitMode: 'equal',
      splits: input.group.users.map((user) => ({ userId: user.userId, value: 1 })),
    })
    .expect(201);
  return response.body.expenseId as string;
}
