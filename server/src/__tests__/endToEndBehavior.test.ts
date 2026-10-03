import { createServer, type Server as HttpServer } from 'http';
import request from 'supertest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { attachSocketIO } from '../sockets';
import { emitGroupDataUpdated } from '../sockets/balanceEmitter';
import { softRemoveGroupMember } from '../models/groupAccess.model';
import { closePool, query, runWithDedicatedClient } from '../utils/db';
import type { PoolClient } from 'pg';

const app = createApp();

function cents(value: number): string {
  return (value / 100).toFixed(2);
}

function isMissingRelation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === '42P01'
  );
}

async function deleteIfPresent(client: PoolClient, table: string): Promise<void> {
  try {
    await client.query(`DELETE FROM ${table}`);
  } catch (err: unknown) {
    if (isMissingRelation(err)) {
      return;
    }
    throw err;
  }
}

async function resetTables(): Promise<void> {
  await runWithDedicatedClient(async (client) => {
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'on', false)`);
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
    await client.query(`SELECT set_config('app.allow_ledger_mutation', 'off', false)`);
  });
}

async function register(email: string, displayName: string): Promise<{
  userId: string;
  token: string;
}> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', display_name: displayName })
    .expect(201);
  return {
    userId: res.body.user.id as string,
    token: res.body.accessToken as string,
  };
}

function listen(server: HttpServer): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      server.off('error', reject);
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
      }
    });
  });
}

function connectSocket(port: number, token: string): Promise<ClientSocket> {
  const socket = createClient(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function joinGroupRoom(
  socket: ClientSocket,
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    socket.emit('join_group', { groupId }, resolve);
  });
}

function waitForSocketEvent<T>(socket: ClientSocket, event: string, timeoutMs = 700): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('demonstrable end-to-end behavior (real PostgreSQL)', () => {
  let server: HttpServer;
  let port: number;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    server = createServer(app);
    attachSocketIO(server);
    port = await listen(server);
  });

  beforeEach(resetTables);

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await resetTables();
    await closePool();
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('creates a group, joins invited members, records all split modes, retries settlement, reconnects, and revokes a removed member', async () => {
    const owner = await register('phase4-owner@example.com', 'Phase4 Owner');
    const memberA = await register('phase4-a@example.com', 'Phase4 A');
    const memberB = await register('phase4-b@example.com', 'Phase4 B');
    const groupRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Phase 4 Sandbox Trip', description: 'End-to-end contract', currency: 'USD' })
      .expect(201);
    const groupId = groupRes.body.group.id as string;
    const inviteCode = groupRes.body.group.invite_code as string;

    for (const member of [memberA, memberB]) {
      await request(app)
        .post('/api/groups/join')
        .set('Authorization', `Bearer ${member.token}`)
        .send({ invite_code: inviteCode })
        .expect(200);
    }

    const members = [owner, memberA, memberB];
    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        amount: '30.00',
        description: 'Equal dinner',
        category: 'food',
        date: '2026-10-01',
        paidBy: owner.userId,
        splitMode: 'equal',
        splits: members.map((member) => ({ userId: member.userId, value: 1 })),
      })
      .expect(201);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${memberA.token}`)
      .send({
        amount: '20.00',
        description: 'Percentage tickets',
        category: 'entertainment',
        date: '2026-10-02',
        paidBy: memberA.userId,
        splitMode: 'percentage',
        splits: [
          { userId: owner.userId, value: '50' },
          { userId: memberA.userId, value: '0' },
          { userId: memberB.userId, value: '50' },
        ],
      })
      .expect(201);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .send({
        amount: '9.00',
        description: 'Exact supplies',
        category: 'other',
        date: '2026-10-03',
        paidBy: memberB.userId,
        splitMode: 'exact',
        splits: [
          { userId: owner.userId, value: '3.00' },
          { userId: memberA.userId, value: '2.00' },
          { userId: memberB.userId, value: '4.00' },
        ],
      })
      .expect(201);

    const expenses = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(expenses.body.expenses).toHaveLength(3);

    const debtRes = await request(app)
      .get(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const debt = debtRes.body.debts.find((line: { amount: number }) => line.amount >= 1);
    expect(debt).toBeTruthy();
    const originalDebtCents = Math.round(Number(debt.amount) * 100);
    const partialCents = Math.max(1, Math.floor(originalDebtCents / 2));
    const settlementBody = {
      fromUserId: debt.fromUserId as string,
      toUserId: debt.toUserId as string,
      amount: cents(partialCents),
      method: 'cash',
      note: 'Phase 4 retry settlement',
    };
    const debtor = [owner, memberA, memberB].find((u) => u.userId === settlementBody.fromUserId);
    expect(debtor).toBeTruthy();

    const firstSettlement = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor!.token}`)
      .set('Idempotency-Key', 'phase4-manual-retry')
      .send(settlementBody)
      .expect(200);
    const retrySettlement = await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor!.token}`)
      .set('Idempotency-Key', 'phase4-manual-retry')
      .send(settlementBody)
      .expect(200);
    expect(retrySettlement.body).toEqual(firstSettlement.body);

    await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor!.token}`)
      .set('Idempotency-Key', 'phase4-manual-retry')
      .send({ ...settlementBody, amount: cents(Math.max(1, partialCents - 1)) })
      .expect(409);

    const settled = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
       FROM settlements s
       INNER JOIN expense_splits es ON es.id = s.expense_split_id
       WHERE es.group_id = $1`,
      [groupId]
    );
    expect(Number(settled.rows[0]?.total ?? 0)).toBeLessThanOrEqual(originalDebtCents);

    const socket = await connectSocket(port, memberB.token);
    sockets.push(socket);
    await expect(joinGroupRoom(socket, groupId)).resolves.toMatchObject({ ok: true });
    socket.disconnect();

    const reconnected = await connectSocket(port, memberB.token);
    sockets.push(reconnected);
    await expect(joinGroupRoom(reconnected, groupId)).resolves.toMatchObject({ ok: true });

    await softRemoveGroupMember({ groupId, userId: memberB.userId });
    const revoked = waitForSocketEvent<{ groupId: string }>(reconnected, 'group_access_revoked');
    await emitGroupDataUpdated(groupId);
    await expect(revoked).resolves.toMatchObject({ groupId });

    await request(app)
      .get(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .expect(404);
  });
});
