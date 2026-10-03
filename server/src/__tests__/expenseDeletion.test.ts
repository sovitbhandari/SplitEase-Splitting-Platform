import request from 'supertest';
import { createApp } from '../app';
import { closePool, query, runWithDedicatedClient } from '../utils/db';
import type { PoolClient } from 'pg';

const app = createApp();

function isMissingRelation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === '42P01'
  );
}

async function deletePaymentTransfersIfPresent(client: PoolClient): Promise<void> {
  try {
    await client.query('DELETE FROM payment_transfers');
  } catch (err: unknown) {
    if (isMissingRelation(err)) {
      return;
    }
    throw err;
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

async function registerUser(email: string, display: string): Promise<{
  userId: string;
  token: string;
}> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'password123',
      display_name: display,
    })
    .expect(201);
  return {
    userId: res.body.user.id as string,
    token: res.body.accessToken as string,
  };
}

async function createTwoPersonExpense(): Promise<{
  debtor: { userId: string; token: string };
  payer: { userId: string; token: string };
  groupId: string;
  expenseId: string;
}> {
  const debtor = await registerUser('delete-debtor@example.com', 'Delete Debtor');
  const payer = await registerUser('delete-payer@example.com', 'Delete Payer');

  const group = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${debtor.token}`)
    .send({ name: 'Audit Trip', description: '', currency: 'USD' })
    .expect(201);
  const groupId = group.body.group.id as string;
  const invite = group.body.group.invite_code as string;

  await request(app)
    .post('/api/groups/join')
    .set('Authorization', `Bearer ${payer.token}`)
    .send({ invite_code: invite })
    .expect(200);

  const expense = await request(app)
    .post(`/api/groups/${groupId}/expenses`)
    .set('Authorization', `Bearer ${payer.token}`)
    .send({
      amount: 100,
      description: 'Train tickets',
      category: 'travel',
      date: '2026-06-01',
      paidBy: payer.userId,
      splitMode: 'equal',
      splits: [
        { userId: debtor.userId, value: 1 },
        { userId: payer.userId, value: 1 },
      ],
    })
    .expect(201);

  return {
    debtor,
    payer,
    groupId,
    expenseId: expense.body.expenseId as string,
  };
}

async function countRows(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await query<{ count: string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

describe('Expense deletion audit behavior', () => {
  beforeEach(async () => {
    await truncateCoreTables();
  });

  afterAll(async () => {
    await truncateCoreTables();
    await closePool();
  });

  it('deletes an unsettled expense and records the deletion in the ledger', async () => {
    const { payer, groupId, expenseId } = await createTwoPersonExpense();

    await request(app)
      .delete(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${payer.token}`)
      .expect(200);

    await expect(
      countRows('SELECT COUNT(*)::text AS count FROM expenses WHERE id = $1', [expenseId])
    ).resolves.toBe(0);
    await expect(
      countRows(
        `SELECT COUNT(*)::text AS count
         FROM ledger_entries
         WHERE group_id = $1 AND event_type = 'expense_deleted'`,
        [groupId]
      )
    ).resolves.toBe(1);
  });

  it('rejects deletion of an expense with settlement history and preserves audit rows', async () => {
    const { debtor, payer, groupId, expenseId } = await createTwoPersonExpense();

    await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor.token}`)
      .set('Idempotency-Key', 'expense-delete-settlement')
      .send({
        fromUserId: debtor.userId,
        toUserId: payer.userId,
        amount: 50,
        method: 'cash',
        note: 'Paid back in cash',
      })
      .expect(200);

    await request(app)
      .delete(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${payer.token}`)
      .expect(409);

    await expect(
      countRows('SELECT COUNT(*)::text AS count FROM expenses WHERE id = $1', [expenseId])
    ).resolves.toBe(1);
    await expect(
      countRows('SELECT COUNT(*)::text AS count FROM expense_splits WHERE expense_id = $1', [
        expenseId,
      ])
    ).resolves.toBe(2);
    await expect(
      countRows(
        `SELECT COUNT(*)::text AS count
         FROM settlements s
         INNER JOIN expense_splits es ON es.id = s.expense_split_id
         WHERE es.expense_id = $1`,
        [expenseId]
      )
    ).resolves.toBe(1);
    await expect(
      countRows(
        `SELECT COUNT(*)::text AS count
         FROM ledger_entries
         WHERE group_id = $1 AND event_type = 'settlement_created'`,
        [groupId]
      )
    ).resolves.toBe(1);
    await expect(
      countRows(
        `SELECT COUNT(*)::text AS count
         FROM ledger_entries
         WHERE group_id = $1 AND event_type = 'expense_deleted'`,
        [groupId]
      )
    ).resolves.toBe(0);
  });
});
