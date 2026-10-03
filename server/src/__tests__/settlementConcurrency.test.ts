import request from 'supertest';
import { createApp } from '../app';
import { closePool, query, runWithDedicatedClient } from '../utils/db';

const app = createApp();

async function reset(): Promise<void> {
  await runWithDedicatedClient(async (client) => {
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'on', false)`);
    await client.query('DELETE FROM idempotency_records');
    await client.query('DELETE FROM provider_webhook_events');
    await client.query('DELETE FROM balance_update_outbox');
    await client.query('DELETE FROM settlements');
    await client.query('DELETE FROM expense_splits');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM ledger_entries');
    await client.query('DELETE FROM group_members');
    await client.query('DELETE FROM groups');
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM email_verifications');
    await client.query('DELETE FROM users');
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'off', false)`);
  });
}

async function fixture(): Promise<{ groupId: string; debtor: { id: string; token: string }; receiver: { id: string; token: string } }> {
  const register = async (email: string, display_name: string) => {
    const response = await request(app).post('/api/auth/register').send({ email, password: 'password123', display_name }).expect(201);
    return { id: response.body.user.id as string, token: response.body.accessToken as string };
  };
  const debtor = await register('concurrent-debtor@example.com', 'Debtor');
  const receiver = await register('concurrent-receiver@example.com', 'Receiver');
  const group = await request(app).post('/api/groups').set('Authorization', `Bearer ${debtor.token}`).send({ name: 'Concurrent', description: '', currency: 'USD' }).expect(201);
  const groupId = group.body.group.id as string;
  await request(app).post('/api/groups/join').set('Authorization', `Bearer ${receiver.token}`).send({ invite_code: group.body.group.invite_code }).expect(200);
  await request(app).post(`/api/groups/${groupId}/expenses`).set('Authorization', `Bearer ${receiver.token}`).send({
    amount: '1.00', description: 'Shared meal', category: 'food', date: '2026-05-01', paidBy: receiver.id,
    splitMode: 'equal', splits: [{ userId: debtor.id, value: 1 }, { userId: receiver.id, value: 1 }],
  }).expect(201);
  return { groupId, debtor, receiver };
}

describe('settlement concurrency contracts (real PostgreSQL)', () => {
  beforeEach(reset);
  afterAll(async () => { await reset(); await closePool(); });

  it('serializes simultaneous full payments so only one can consume the debt', async () => {
    const f = await fixture();
    const path = `/api/groups/${f.groupId}/settlements`;
    const body = { fromUserId: f.debtor.id, toUserId: f.receiver.id, amount: '0.50', method: 'cash' };
    const results = await Promise.all([
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'full-a').send(body),
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'full-b').send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const settled = await query<{ total: string }>('SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM settlements');
    expect(settled.rows[0]?.total).toBe('50');
  });

  it('converges same-key duplicates and rejects a different payload', async () => {
    const f = await fixture();
    const path = `/api/groups/${f.groupId}/settlements`;
    const first = { fromUserId: f.debtor.id, toUserId: f.receiver.id, amount: '0.25', method: 'cash' };
    const [a, b] = await Promise.all([
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'same-key').send(first),
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'same-key').send(first),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(b.body);
    const conflict = await request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'same-key').send({ ...first, amount: '0.20' });
    expect(conflict.status).toBe(409);
    const count = await query<{ c: string }>('SELECT COUNT(*)::text AS c FROM settlements');
    expect(count.rows[0]?.c).toBe('1');
  });

  it('rejects concurrent partial overpayment without clamping', async () => {
    const f = await fixture();
    const path = `/api/groups/${f.groupId}/settlements`;
    const body = { fromUserId: f.debtor.id, toUserId: f.receiver.id, amount: '0.30', method: 'cash' };
    const results = await Promise.all([
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'partial-a').send(body),
      request(app).post(path).set('Authorization', `Bearer ${f.debtor.token}`).set('Idempotency-Key', 'partial-b').send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const settled = await query<{ total: string }>('SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM settlements');
    expect(settled.rows[0]?.total).toBe('30');
  });
});
