import { createServer, type Server as HttpServer } from 'http';
import request from 'supertest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { attachSocketIO } from '../sockets';
import { emitGroupDataUpdated, emitBalanceUpdateToGroup } from '../sockets/balanceEmitter';
import { closePool, query, runWithDedicatedClient } from '../utils/db';
import { softRemoveGroupMember } from '../models/groupAccess.model';
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

async function createGroupFor(owner: { token: string }, name: string): Promise<{
  groupId: string;
  inviteCode: string;
}> {
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name, description: '', currency: 'USD' })
    .expect(201);
  return {
    groupId: res.body.group.id as string,
    inviteCode: res.body.group.invite_code as string,
  };
}

async function joinGroup(user: { token: string }, inviteCode: string): Promise<void> {
  await request(app)
    .post('/api/groups/join')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ invite_code: inviteCode })
    .expect(200);
}

async function createEqualExpense(input: {
  groupId: string;
  payer: { userId: string; token: string };
  debtor: { userId: string };
  amount?: number;
}): Promise<string> {
  const res = await request(app)
    .post(`/api/groups/${input.groupId}/expenses`)
    .set('Authorization', `Bearer ${input.payer.token}`)
    .send({
      amount: input.amount ?? 100,
      description: 'Shared hotel',
      category: 'travel',
      date: '2026-07-01',
      paidBy: input.payer.userId,
      splitMode: 'equal',
      splits: [
        { userId: input.debtor.userId, value: 1 },
        { userId: input.payer.userId, value: 1 },
      ],
    })
    .expect(201);
  return res.body.expenseId as string;
}

function listen(server: HttpServer): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, () => {
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

function waitForSocketEvent<T>(socket: ClientSocket, event: string, timeoutMs = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function expectNoSocketEvent(
  socket: ClientSocket,
  event: string,
  timeoutMs = 150
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, timeoutMs);
    socket.once(event, () => {
      clearTimeout(timer);
      reject(new Error(`Unexpected ${event}`));
    });
  });
}

describe('group resource authorization policy', () => {
  let httpServer: HttpServer;
  let socketPort: number;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    httpServer = createServer(app);
    attachSocketIO(httpServer);
    socketPort = await listen(httpServer);
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await truncateCoreTables();
    await closePool();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('returns 404 for outsiders and members of another group with a known group UUID', async () => {
    const owner = await registerUser('auth-owner@example.com', 'Auth Owner');
    const outsider = await registerUser('auth-outsider@example.com', 'Auth Outsider');
    const otherOwner = await registerUser('auth-other@example.com', 'Other Owner');
    const { groupId } = await createGroupFor(owner, 'Private Trip');
    await createGroupFor(otherOwner, 'Other Trip');

    await request(app)
      .get(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(404);
    await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(404);
    await request(app)
      .get(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${otherOwner.token}`)
      .expect(404);
    await request(app)
      .get(`/api/groups/${groupId}/payment-methods`)
      .set('Authorization', `Bearer ${otherOwner.token}`)
      .expect(404);
  });

  it('returns 400 for malformed group UUIDs before querying group resources', async () => {
    const user = await registerUser('invalid-group-id@example.com', 'Invalid Group');

    await request(app)
      .get('/api/groups/not-a-uuid/expenses')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(400);
    await request(app)
      .get('/api/groups/not-a-uuid/settlements')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(400);
  });

  it('rejects forged payers, forged split participants, duplicate participants, and invalid UUIDs', async () => {
    const payer = await registerUser('payer-authz@example.com', 'Payer');
    const member = await registerUser('member-authz@example.com', 'Member');
    const outsider = await registerUser('split-outsider@example.com', 'Outsider');
    const { groupId, inviteCode } = await createGroupFor(payer, 'Validation Trip');
    await joinGroup(member, inviteCode);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: 20,
        description: 'Forged payer',
        category: 'other',
        date: '2026-07-02',
        paidBy: member.userId,
        splitMode: 'equal',
        splits: [
          { userId: payer.userId, value: 1 },
          { userId: member.userId, value: 1 },
        ],
      })
      .expect(403);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: 20,
        description: 'Forged split',
        category: 'other',
        date: '2026-07-02',
        paidBy: payer.userId,
        splitMode: 'equal',
        splits: [
          { userId: payer.userId, value: 1 },
          { userId: outsider.userId, value: 1 },
        ],
      })
      .expect(403);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: 20,
        description: 'Duplicate split',
        category: 'other',
        date: '2026-07-02',
        paidBy: payer.userId,
        splitMode: 'equal',
        splits: [
          { userId: payer.userId, value: 1 },
          { userId: payer.userId, value: 1 },
        ],
      })
      .expect(400);

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${payer.token}`)
      .send({
        amount: 20,
        description: 'Invalid split id',
        category: 'other',
        date: '2026-07-02',
        paidBy: payer.userId,
        splitMode: 'equal',
        splits: [{ userId: 'not-a-uuid', value: 1 }],
      })
      .expect(400);
  });

  it('blocks removed members from group reads and sockets while allowing settlement of old obligations', async () => {
    const debtor = await registerUser('removed-debtor@example.com', 'Removed Debtor');
    const payer = await registerUser('removed-payer@example.com', 'Removed Payer');
    const { groupId, inviteCode } = await createGroupFor(debtor, 'Historical Trip');
    await joinGroup(payer, inviteCode);
    await createEqualExpense({ groupId, payer, debtor });
    await softRemoveGroupMember({ groupId, userId: debtor.userId });

    await request(app)
      .get(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${debtor.token}`)
      .expect(404);
    await request(app)
      .get(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor.token}`)
      .expect(404);
    await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${debtor.token}`)
      .expect(404);

    await request(app)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${debtor.token}`)
      .set('Idempotency-Key', 'removed-member-old-obligation')
      .send({
        fromUserId: debtor.userId,
        toUserId: payer.userId,
        amount: 50,
        method: 'cash',
        note: 'Settling after leaving',
      })
      .expect(200);

    const settlementCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM settlements`
    );
    expect(Number(settlementCount.rows[0]?.count ?? 0)).toBe(1);
  });

  it('acknowledges socket authorization failures and does not subscribe unauthorized clients', async () => {
    const owner = await registerUser('socket-owner@example.com', 'Socket Owner');
    const outsider = await registerUser('socket-outsider@example.com', 'Socket Outsider');
    const { groupId } = await createGroupFor(owner, 'Socket Trip');
    const socket = await connectSocket(socketPort, outsider.token);
    sockets.push(socket);

    await expect(joinGroupRoom(socket, 'not-a-uuid')).resolves.toMatchObject({
      ok: false,
      error: 'Invalid group id',
    });
    await expect(joinGroupRoom(socket, groupId)).resolves.toMatchObject({
      ok: false,
      error: 'Group not found',
    });

    await emitBalanceUpdateToGroup(groupId, []);
    await expectNoSocketEvent(socket, 'balance_updated');
  });

  it('evicts sockets when current membership is revoked', async () => {
    const member = await registerUser('socket-member@example.com', 'Socket Member');
    const payer = await registerUser('socket-payer@example.com', 'Socket Payer');
    const { groupId, inviteCode } = await createGroupFor(member, 'Revocation Trip');
    await joinGroup(payer, inviteCode);
    const socket = await connectSocket(socketPort, member.token);
    sockets.push(socket);

    await expect(joinGroupRoom(socket, groupId)).resolves.toMatchObject({ ok: true });
    await softRemoveGroupMember({ groupId, userId: member.userId });

    const revoked = waitForSocketEvent<{ groupId: string }>(socket, 'group_access_revoked');
    await emitGroupDataUpdated(groupId);
    await expect(revoked).resolves.toMatchObject({ groupId });
    await emitGroupDataUpdated(groupId);
    await expectNoSocketEvent(socket, 'group_data_updated');
  });
});
