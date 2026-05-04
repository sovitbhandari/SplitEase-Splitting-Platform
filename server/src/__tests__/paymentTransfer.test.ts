import request from 'supertest';
import { createApp } from '../app';
import { closePool, runWithDedicatedClient } from '../utils/db';
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

describe('Payment transfer API', () => {
  beforeEach(async () => {
    await truncateCoreTables();
  });

  afterAll(async () => {
    await truncateCoreTables();
    await closePool();
  });

  it('GET /api/groups/:groupId/payment-methods returns 401 without auth', async () => {
    await request(app)
      .get('/api/groups/00000000-0000-0000-0000-000000000001/payment-methods')
      .expect(401);
  });

  it('POST preview returns 403 when authenticated user is not the debtor', async () => {
    const a = await registerUser('debtor@example.com', 'Alex');
    const b = await registerUser('receiver@example.com', 'Blake');

    const g = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ name: 'Trip', description: '', currency: 'USD' })
      .expect(201);
    const groupId = g.body.group.id as string;
    const invite = g.body.group.invite_code as string;

    await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ invite_code: invite })
      .expect(200);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({
        amount: 100,
        description: 'Dinner',
        category: 'food',
        date: '2026-05-01',
        paidBy: b.userId,
        splitMode: 'equal',
        splits: [
          { userId: a.userId, value: 1 },
          { userId: b.userId, value: 1 },
        ],
      })
      .expect(201);

    const settlementId = `${a.userId}_${b.userId}`;
    const fakeAccount = '00000000-0000-0000-0000-000000000099';

    await request(app)
      .post(`/api/groups/${groupId}/settlements/${settlementId}/transfer/preview`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ fromPlaidAccountId: fakeAccount, amount: 50 })
      .expect(403);
  });

  it('POST preview returns canTransfer false when sandbox transfer is disabled', async () => {
    const a = await registerUser('debtor2@example.com', 'Alex2');
    const b = await registerUser('recv2@example.com', 'Blake2');

    const g = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ name: 'Trip2', description: '', currency: 'USD' })
      .expect(201);
    const groupId = g.body.group.id as string;
    const invite = g.body.group.invite_code as string;

    await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ invite_code: invite })
      .expect(200);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({
        amount: 100,
        description: 'Dinner',
        category: 'food',
        date: '2026-05-02',
        paidBy: b.userId,
        splitMode: 'equal',
        splits: [
          { userId: a.userId, value: 1 },
          { userId: b.userId, value: 1 },
        ],
      })
      .expect(201);

    const settlementId = `${a.userId}_${b.userId}`;
    const fakeAccount = '00000000-0000-0000-0000-000000000088';

    const res = await request(app)
      .post(`/api/groups/${groupId}/settlements/${settlementId}/transfer/preview`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ fromPlaidAccountId: fakeAccount, amount: 50 })
      .expect(200);

    expect(res.body.canTransfer).toBe(false);
    expect(typeof res.body.message).toBe('string');
  });

  it('POST create returns 503 when Plaid Transfer is not enabled', async () => {
    const a = await registerUser('payer@example.com', 'Pat');
    const b = await registerUser('recv3@example.com', 'Quinn');

    const g = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ name: 'Trip3', description: '', currency: 'USD' })
      .expect(201);
    const groupId = g.body.group.id as string;
    const invite = g.body.group.invite_code as string;

    await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ invite_code: invite })
      .expect(200);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({
        amount: 20,
        description: 'X',
        category: 'other',
        date: '2026-05-03',
        paidBy: b.userId,
        splitMode: 'equal',
        splits: [
          { userId: a.userId, value: 1 },
          { userId: b.userId, value: 1 },
        ],
      })
      .expect(201);

    const settlementId = `${a.userId}_${b.userId}`;

    await request(app)
      .post(`/api/groups/${groupId}/settlements/${settlementId}/transfer/create`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        fromPlaidAccountId: '00000000-0000-0000-0000-000000000077',
        amount: 10,
      })
      .expect(503);
  });
});
