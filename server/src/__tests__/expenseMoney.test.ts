import request from 'supertest';
import { createApp } from '../app';
import { closePool, query, runWithDedicatedClient } from '../utils/db';
import type { PoolClient } from 'pg';

const app = createApp();

async function deletePaymentTransfersIfPresent(client: PoolClient): Promise<void> {
  try {
    await client.query('DELETE FROM payment_transfers');
  } catch {
    return;
  }
}

async function truncateCoreTables(): Promise<void> {
  await runWithDedicatedClient(async (client) => {
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'on', false)`);
    await deletePaymentTransfersIfPresent(client);
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
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'off', false)`);
  });
}

async function registerUser(email: string): Promise<{ userId: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', display_name: email })
    .expect(201);
  return { userId: res.body.user.id as string, token: res.body.accessToken as string };
}

async function createGroupWithMembers(count: number): Promise<{
  groupId: string;
  users: Array<{ userId: string; token: string }>;
}> {
  const users = await Promise.all(
    Array.from({ length: count }, (_, index) => registerUser(`money-${count}-${index}@example.com`))
  );
  const group = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${users[0]!.token}`)
    .send({ name: `Money ${count}`, description: '', currency: 'USD' })
    .expect(201);
  const groupId = group.body.group.id as string;
  const invite = group.body.group.invite_code as string;
  for (const user of users.slice(1)) {
    await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ invite_code: invite })
      .expect(200);
  }
  return { groupId, users };
}

describe('expense money validation and storage', () => {
  beforeEach(async () => {
    await truncateCoreTables();
  });

  afterAll(async () => {
    await truncateCoreTables();
    await closePool();
  });

  it('stores $0.03 split across 5 people as nonnegative cents that sum exactly', async () => {
    const { groupId, users } = await createGroupWithMembers(5);
    const payer = users[0]!;
    const res = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: '0.03',
        description: 'Tiny split',
        category: 'other',
        date: '2026-08-01',
        paidBy: payer.userId,
        splitMode: 'equal',
        splits: users.map((user) => ({ userId: user.userId, value: 1 })),
      })
      .expect(201);

    const rows = await query<{ amount_owed_cents: string }>(
      `SELECT amount_owed_cents::text
       FROM expense_splits
       WHERE expense_id = $1
       ORDER BY amount_owed_cents ASC`,
      [res.body.expenseId]
    );
    expect(rows.rows.map((row) => Number(row.amount_owed_cents))).toEqual([0, 0, 1, 1, 1]);
  });

  it('accepts exact zero-share participants and rejects unsupported precision', async () => {
    const { groupId, users } = await createGroupWithMembers(3);
    const payer = users[0]!;

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: '0.03',
        description: 'Zero exact share',
        category: 'other',
        date: '2026-08-02',
        paidBy: payer.userId,
        splitMode: 'exact',
        splits: [
          { userId: users[0]!.userId, value: '0' },
          { userId: users[1]!.userId, value: '0.01' },
          { userId: users[2]!.userId, value: '0.02' },
        ],
      })
      .expect(201);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: '0.001',
        description: 'Too precise',
        category: 'other',
        date: '2026-08-02',
        paidBy: payer.userId,
        splitMode: 'equal',
        splits: users.map((user) => ({ userId: user.userId, value: 1 })),
      })
      .expect(400);
  });
});
