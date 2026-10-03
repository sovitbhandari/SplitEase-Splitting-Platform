import {
  ACHClass,
  TransferAuthorizationDecision,
  TransferNetwork,
  TransferStatus,
  TransferType,
} from 'plaid';
import { loadEnv } from '../config/env';
import {
  getPlaidClient,
  isPlaidTransferFeatureEnabled,
  shouldLabelAsSandboxTransfer,
} from '../utils/plaidClient';
import { getDebtorPlaidContextForAccount } from '../models/plaidAccess.model';
import { dollarsToCents, centsToDecimalString } from '../utils/money';
import {
  findPaymentTransferById,
  findPaymentTransferByPlaidTransferId,
  findPaymentTransferByIdempotency,
  insertPaymentTransfer,
  type PaymentTransferStatus,
  type PaymentTransferRow,
  updatePaymentTransferById,
} from '../models/paymentTransfer.model';
import { query, withTransaction } from '../utils/db';
import { computeGroupBalances } from '../utils/balanceEngine';
import { emitBalanceUpdateToGroup, emitGroupDataUpdated } from '../sockets/balanceEmitter';
import { lockSettlementPair, settleDebtBetweenUsersInTransaction } from '../models/settlement.model';
import { hashCanonicalRequest } from '../models/idempotency.model';

function shouldApplySettlementFromPlaidStatus(st: TransferStatus): boolean {
  if (st === TransferStatus.Settled || st === TransferStatus.FundsAvailable) {
    return true;
  }
  return false;
}

function mapPlaidStatusToDb(st: TransferStatus): PaymentTransferStatus {
  switch (st) {
    case TransferStatus.Pending:
      return 'pending';
    case TransferStatus.Posted:
      return 'posted';
    case TransferStatus.Settled:
    case TransferStatus.FundsAvailable:
      return 'posted';
    case TransferStatus.Failed:
      return 'failed';
    case TransferStatus.Cancelled:
      return 'cancelled';
    case TransferStatus.Returned:
      return 'returned';
    default:
      return 'pending';
  }
}

function shouldAcceptStatus(current: PaymentTransferStatus, next: PaymentTransferStatus): boolean {
  if (current === 'posted' || current === 'settled_manually') return next === 'posted';
  if (current === 'failed' || current === 'cancelled' || current === 'returned') return current === next;
  return true;
}

async function appendLedger(
  groupId: string,
  eventType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO ledger_entries (group_id, event_type, entity_id, payload)
     VALUES ($1, $2, $3::uuid, $4::jsonb)`,
    [groupId, eventType, entityId, JSON.stringify(payload)]
  );
}

async function applySuccessfulTransfer(rowId: string): Promise<void> {
  const groupId = await withTransaction(async (client) => {
    const locked = await client.query<PaymentTransferRow>(
      `SELECT id, group_id, settlement_key, debtor_user_id, receiver_user_id,
              initiated_by_user_id, debtor_plaid_item_id, debtor_internal_account_id,
              debtor_plaid_account_id, receiver_plaid_item_id, receiver_plaid_account_id,
              amount_cents::text, currency, plaid_transfer_id, plaid_authorization_id,
              status, failure_code, failure_reason, note, idempotency_key, request_hash,
              settlement_applied, created_at, updated_at
       FROM payment_transfers WHERE id = $1 FOR UPDATE`,
      [rowId]
    );
    const row = locked.rows[0];
    if (!row || row.settlement_applied) return row?.group_id ?? null;
    const separator = row.settlement_key.indexOf('_');
    if (separator <= 0) throw new Error('Invalid settlement key on payment transfer');
    const fromUserId = row.settlement_key.slice(0, separator);
    const toUserId = row.settlement_key.slice(separator + 1);
    await lockSettlementPair(client, { groupId: row.group_id, fromUserId, toUserId });
    await settleDebtBetweenUsersInTransaction(client, {
      groupId: row.group_id,
      fromUserId,
      toUserId,
      amount: Number(row.amount_cents) / 100,
      method: 'plaid_transfer',
      note: row.note ?? undefined,
      paymentTransferId: row.id,
    });
    await client.query(
      `UPDATE payment_transfers SET status = 'posted', settlement_applied = true, updated_at = now() WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `INSERT INTO ledger_entries (group_id, event_type, entity_id, payload)
       VALUES ($1, 'payment_posted', $2::uuid, $3::jsonb)`,
      [row.group_id, row.id, JSON.stringify({ paymentTransferId: row.id, plaidTransferId: row.plaid_transfer_id, sandbox: shouldLabelAsSandboxTransfer() })]
    );
    await client.query(
      `INSERT INTO balance_update_outbox (group_id, event_type, payload) VALUES ($1, 'payment_posted', $2::jsonb)`,
      [row.group_id, JSON.stringify({ paymentTransferId: row.id })]
    );
    return row.group_id;
  });
  if (!groupId) return;
  const balances = await computeGroupBalances(groupId);
  await emitBalanceUpdateToGroup(groupId, balances);
  await emitGroupDataUpdated(groupId);
}

export async function syncPaymentTransferFromPlaidStatus(input: {
  paymentTransferId: string;
  plaidStatus: TransferStatus;
}): Promise<void> {
  const row = await findPaymentTransferById(input.paymentTransferId);
  if (!row) {
    return;
  }
  const dbStatus = mapPlaidStatusToDb(input.plaidStatus);
  if (shouldAcceptStatus(row.status, dbStatus)) {
    await updatePaymentTransferById({ id: row.id, status: dbStatus });
  }

  if (shouldApplySettlementFromPlaidStatus(input.plaidStatus) && !row.settlement_applied) {
    await applySuccessfulTransfer(row.id);
  }

  if (
    input.plaidStatus === TransferStatus.Failed ||
    input.plaidStatus === TransferStatus.Returned ||
    input.plaidStatus === TransferStatus.Cancelled
  ) {
    await appendLedger(row.group_id, 'payment_failed', row.id, {
      paymentTransferId: row.id,
      plaidStatus: input.plaidStatus,
      sandbox: shouldLabelAsSandboxTransfer(),
    });
  }
}

export async function handleTransferWebhookByPlaidId(plaidTransferId: string): Promise<void> {
  const row = await findPaymentTransferByPlaidTransferId(plaidTransferId);
  if (!row) {
    return;
  }
  const plaid = getPlaidClient();
  const transferGet = await plaid.transferGet({
    transfer_id: plaidTransferId,
  });
  await syncPaymentTransferFromPlaidStatus({
    paymentTransferId: row.id,
    plaidStatus: transferGet.data.transfer.status,
  });
  const updated = await findPaymentTransferByPlaidTransferId(plaidTransferId);
  const gid = updated?.group_id ?? row.group_id;
  const balances = await computeGroupBalances(gid);
  await emitBalanceUpdateToGroup(gid, balances);
  await emitGroupDataUpdated(gid);
}

export type CreateSandboxTransferResult =
  | { ok: true; paymentTransferId: string; plaidTransferId: string }
  | { ok: false; code: string; message: string; paymentTransferId?: string };

export function buildTransferRequestHash(input: {
  groupId: string;
  settlementKey: string;
  debtorUserId: string;
  receiverUserId: string;
  internalAccountId: string;
  amountCents: bigint | number | string;
  note: string | null;
}): string {
  return hashCanonicalRequest({
    groupId: input.groupId,
    settlementKey: input.settlementKey,
    debtorUserId: input.debtorUserId,
    receiverUserId: input.receiverUserId,
    internalAccountId: input.internalAccountId,
    amountCents: input.amountCents.toString(),
    note: input.note,
  });
}

export async function createAuthorizedTransfer(input: {
  userId: string;
  groupId: string;
  settlementKey: string;
  debtorUserId: string;
  receiverUserId: string;
  internalAccountId: string;
  amountDollars: number;
  note: string | null;
  idempotencyKey: string;
}): Promise<CreateSandboxTransferResult> {
  if (!isPlaidTransferFeatureEnabled()) {
    return {
      ok: false,
      code: 'transfer_disabled',
      message: 'Plaid Transfer is not enabled in this environment.',
    };
  }

  const env = loadEnv();
  if (env.PLAID_ENV === 'production' && !env.ENABLE_REAL_MONEY_MOVEMENT) {
    return {
      ok: false,
      code: 'production_disabled',
      message:
        'Production money movement is disabled (ENABLE_REAL_MONEY_MOVEMENT). Use Sandbox credentials or manual settlement.',
    };
  }

  const amountCents = dollarsToCents(input.amountDollars);
  const requestHash = buildTransferRequestHash({
    groupId: input.groupId,
    settlementKey: input.settlementKey,
    debtorUserId: input.debtorUserId,
    receiverUserId: input.receiverUserId,
    internalAccountId: input.internalAccountId,
    amountCents: amountCents.toString(),
    note: input.note,
  });
  const prior = await findPaymentTransferByIdempotency({
    initiatedByUserId: input.userId,
    groupId: input.groupId,
    idempotencyKey: input.idempotencyKey,
  });
  if (prior) {
    if (prior.request_hash !== requestHash) {
      return { ok: false, code: 'idempotency_conflict', message: 'Idempotency-Key was already used with a different request payload.' };
    }
    if (!prior.plaid_transfer_id) {
      return { ok: false, code: prior.status === 'failed' ? 'authorization_declined' : 'transfer_pending', message: prior.failure_reason ?? 'Transfer is already recorded.', paymentTransferId: prior.id };
    }
    return { ok: true, paymentTransferId: prior.id, plaidTransferId: prior.plaid_transfer_id };
  }
  if (amountCents <= BigInt(0)) {
    return { ok: false, code: 'invalid_amount', message: 'Amount must be positive.' };
  }

  if (input.userId !== input.debtorUserId) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Only the person who owes money can start this payment.',
    };
  }

  const ctx = await getDebtorPlaidContextForAccount({
    userId: input.userId,
    internalAccountId: input.internalAccountId,
  });
  if (!ctx) {
    return {
      ok: false,
      code: 'no_account',
      message: 'This bank account is not available for transfers.',
    };
  }

  const userRow = await query<{ display_name: string; email: string }>(
    `SELECT display_name, email FROM users WHERE id = $1`,
    [input.userId]
  );
  const legalName = userRow.rows[0]?.display_name?.trim() || userRow.rows[0]?.email || 'Account holder';

  const plaid = getPlaidClient();
  const amountStr = centsToDecimalString(amountCents);

  let authId: string;
  try {
    const authRes = await plaid.transferAuthorizationCreate({
      access_token: ctx.accessToken,
      account_id: ctx.plaidAccountId,
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      ach_class: ACHClass.Web,
      amount: amountStr,
      user: { legal_name: legalName },
      idempotency_key: input.idempotencyKey.slice(0, 50),
    });
    const auth = authRes.data.authorization;
    authId = auth.id;
    if (auth.decision !== TransferAuthorizationDecision.Approved) {
      const rationale = auth.decision_rationale;
      const inserted = await insertPaymentTransfer({
        groupId: input.groupId,
        settlementKey: input.settlementKey,
        debtorUserId: input.debtorUserId,
        receiverUserId: input.receiverUserId,
        initiatedByUserId: input.userId,
        debtorPlaidItemId: ctx.plaidItemDbId,
        debtorInternalAccountId: input.internalAccountId,
        debtorPlaidAccountId: ctx.plaidAccountId,
        receiverPlaidItemId: null,
        receiverPlaidAccountId: null,
        amountCents,
        currency: 'USD',
        plaidTransferId: null,
        plaidAuthorizationId: authId,
        status: 'failed',
        failureCode: rationale?.code ?? 'declined',
        failureReason: rationale?.description ?? 'Transfer authorization was declined.',
        note: input.note,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      });
      await appendLedger(input.groupId, 'payment_initiated', inserted.id, {
        outcome: 'authorization_declined',
        sandbox: shouldLabelAsSandboxTransfer(),
      });
      return {
        ok: false,
        code: 'authorization_declined',
        message: rationale?.description ?? 'Transfer authorization was declined.',
        paymentTransferId: inserted.id,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Authorization failed';
    return { ok: false, code: 'plaid_error', message: msg };
  }

  try {
    const createRes = await plaid.transferCreate({
      access_token: ctx.accessToken,
      account_id: ctx.plaidAccountId,
      authorization_id: authId,
      amount: amountStr,
      description: 'SplEase settle',
    });
    const transfer = createRes.data.transfer;
    const inserted = await insertPaymentTransfer({
      groupId: input.groupId,
      settlementKey: input.settlementKey,
      debtorUserId: input.debtorUserId,
      receiverUserId: input.receiverUserId,
      initiatedByUserId: input.userId,
      debtorPlaidItemId: ctx.plaidItemDbId,
      debtorInternalAccountId: input.internalAccountId,
      debtorPlaidAccountId: ctx.plaidAccountId,
      receiverPlaidItemId: null,
      receiverPlaidAccountId: null,
      amountCents,
      currency: 'USD',
      plaidTransferId: transfer.id,
      plaidAuthorizationId: authId,
      status: mapPlaidStatusToDb(transfer.status),
      failureCode: null,
      failureReason: null,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    });

    await appendLedger(input.groupId, 'payment_initiated', inserted.id, {
      plaidTransferId: transfer.id,
      plaidStatus: transfer.status,
      sandbox: shouldLabelAsSandboxTransfer(),
    });

    await syncPaymentTransferFromPlaidStatus({
      paymentTransferId: inserted.id,
      plaidStatus: transfer.status,
    });

    return { ok: true, paymentTransferId: inserted.id, plaidTransferId: transfer.id };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
      const prior = await findPaymentTransferByIdempotency({
        initiatedByUserId: input.userId,
        groupId: input.groupId,
        idempotencyKey: input.idempotencyKey,
      });
      if (prior?.request_hash === requestHash && prior.plaid_transfer_id) {
        return { ok: true, paymentTransferId: prior.id, plaidTransferId: prior.plaid_transfer_id };
      }
    }
    const msg = err instanceof Error ? err.message : 'Transfer create failed';
    return { ok: false, code: 'plaid_error', message: msg };
  }
}
