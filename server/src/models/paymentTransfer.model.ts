import { query } from '../utils/db';

export type PaymentTransferStatus =
  | 'pending_authorization'
  | 'authorized'
  | 'pending'
  | 'posted'
  | 'failed'
  | 'cancelled'
  | 'returned'
  | 'settled_manually';

export type PaymentTransferRow = {
  id: string;
  group_id: string;
  settlement_key: string;
  debtor_user_id: string;
  receiver_user_id: string;
  initiated_by_user_id: string;
  debtor_plaid_item_id: string | null;
  debtor_internal_account_id: string | null;
  debtor_plaid_account_id: string;
  receiver_plaid_item_id: string | null;
  receiver_plaid_account_id: string | null;
  amount_cents: string;
  currency: string;
  plaid_transfer_id: string | null;
  plaid_authorization_id: string | null;
  status: PaymentTransferStatus;
  failure_code: string | null;
  failure_reason: string | null;
  note: string | null;
  idempotency_key: string;
  request_hash: string | null;
  settlement_applied: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function hasPendingLikeTransfer(
  groupId: string,
  settlementKey: string
): Promise<boolean> {
  const { rows } = await query<{ c: string }>(
    `SELECT count(*)::text AS c
     FROM payment_transfers
     WHERE group_id = $1
       AND settlement_key = $2
       AND settlement_applied = false
       AND status IN ('pending_authorization', 'authorized', 'pending', 'posted')`,
    [groupId, settlementKey]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function insertPaymentTransfer(input: {
  groupId: string;
  settlementKey: string;
  debtorUserId: string;
  receiverUserId: string;
  initiatedByUserId: string;
  debtorPlaidItemId: string | null;
  debtorInternalAccountId: string | null;
  debtorPlaidAccountId: string;
  receiverPlaidItemId: string | null;
  receiverPlaidAccountId: string | null;
  amountCents: bigint;
  currency: string;
  plaidTransferId: string | null;
  plaidAuthorizationId: string | null;
  status: PaymentTransferStatus;
  failureCode: string | null;
  failureReason: string | null;
  note: string | null;
  idempotencyKey: string;
  requestHash?: string | null;
}): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO payment_transfers (
       group_id, settlement_key, debtor_user_id, receiver_user_id, initiated_by_user_id,
       debtor_plaid_item_id, debtor_internal_account_id, debtor_plaid_account_id,
       receiver_plaid_item_id, receiver_plaid_account_id,
       amount_cents, currency, plaid_transfer_id, plaid_authorization_id,
       status, failure_code, failure_reason, note, idempotency_key, request_hash
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
     )
     RETURNING id`,
    [
      input.groupId,
      input.settlementKey,
      input.debtorUserId,
      input.receiverUserId,
      input.initiatedByUserId,
      input.debtorPlaidItemId,
      input.debtorInternalAccountId,
      input.debtorPlaidAccountId,
      input.receiverPlaidItemId,
      input.receiverPlaidAccountId,
      input.amountCents.toString(),
      input.currency,
      input.plaidTransferId,
      input.plaidAuthorizationId,
      input.status,
      input.failureCode,
      input.failureReason,
      input.note,
      input.idempotencyKey,
      input.requestHash ?? null,
    ]
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Failed to insert payment transfer');
  }
  return row;
}

export async function updatePaymentTransferById(input: {
  id: string;
  status: PaymentTransferStatus;
  plaidTransferId?: string | null;
  plaidAuthorizationId?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  settlementApplied?: boolean;
}): Promise<void> {
  await query(
    `UPDATE payment_transfers
     SET status = $2,
         plaid_transfer_id = COALESCE($3, plaid_transfer_id),
         plaid_authorization_id = COALESCE($4, plaid_authorization_id),
         failure_code = COALESCE($5, failure_code),
         failure_reason = COALESCE($6, failure_reason),
         settlement_applied = COALESCE($7, settlement_applied),
         updated_at = now()
     WHERE id = $1`,
    [
      input.id,
      input.status,
      input.plaidTransferId ?? null,
      input.plaidAuthorizationId ?? null,
      input.failureCode ?? null,
      input.failureReason ?? null,
      input.settlementApplied ?? null,
    ]
  );
}

export async function findPaymentTransferByPlaidTransferId(
  plaidTransferId: string
): Promise<PaymentTransferRow | null> {
  const { rows } = await query<PaymentTransferRow>(
    `SELECT
       id, group_id, settlement_key, debtor_user_id, receiver_user_id, initiated_by_user_id,
       debtor_plaid_item_id, debtor_internal_account_id, debtor_plaid_account_id,
       receiver_plaid_item_id, receiver_plaid_account_id,
       amount_cents::text, currency, plaid_transfer_id, plaid_authorization_id,
       status, failure_code, failure_reason, note, idempotency_key, request_hash,
       settlement_applied, created_at, updated_at
     FROM payment_transfers
     WHERE plaid_transfer_id = $1`,
    [plaidTransferId]
  );
  return rows[0] ?? null;
}

export async function findPaymentTransferById(id: string): Promise<PaymentTransferRow | null> {
  const { rows } = await query<PaymentTransferRow>(
    `SELECT
       id, group_id, settlement_key, debtor_user_id, receiver_user_id, initiated_by_user_id,
       debtor_plaid_item_id, debtor_internal_account_id, debtor_plaid_account_id,
       receiver_plaid_item_id, receiver_plaid_account_id,
       amount_cents::text, currency, plaid_transfer_id, plaid_authorization_id,
       status, failure_code, failure_reason, note, idempotency_key, request_hash,
       settlement_applied, created_at, updated_at
     FROM payment_transfers
     WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findPaymentTransferByIdempotency(input: {
  initiatedByUserId: string;
  groupId: string;
  idempotencyKey: string;
}): Promise<PaymentTransferRow | null> {
  const { rows } = await query<PaymentTransferRow>(
    `SELECT
       id, group_id, settlement_key, debtor_user_id, receiver_user_id, initiated_by_user_id,
       debtor_plaid_item_id, debtor_internal_account_id, debtor_plaid_account_id,
       receiver_plaid_item_id, receiver_plaid_account_id,
       amount_cents::text, currency, plaid_transfer_id, plaid_authorization_id,
       status, failure_code, failure_reason, note, idempotency_key, request_hash,
       settlement_applied, created_at, updated_at
     FROM payment_transfers
     WHERE initiated_by_user_id = $1 AND group_id = $2 AND idempotency_key = $3
     ORDER BY created_at DESC LIMIT 1`,
    [input.initiatedByUserId, input.groupId, input.idempotencyKey]
  );
  return rows[0] ?? null;
}

export type TransferHistoryRow = {
  id: string;
  settlement_key: string;
  amount_cents: string;
  status: PaymentTransferStatus;
  debtor_name: string;
  receiver_name: string;
  note: string | null;
  settlement_applied: boolean;
  plaid_transfer_id: string | null;
  plaid_authorization_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listPaymentTransfersForGroup(
  groupId: string
): Promise<TransferHistoryRow[]> {
  const { rows } = await query<TransferHistoryRow>(
    `SELECT
       pt.id,
       pt.settlement_key,
       pt.amount_cents::text,
       pt.status,
       du.display_name AS debtor_name,
       ru.display_name AS receiver_name,
       pt.note,
       pt.settlement_applied,
       pt.plaid_transfer_id,
       pt.plaid_authorization_id,
       pt.created_at,
       pt.updated_at
     FROM payment_transfers pt
     INNER JOIN users du ON du.id = pt.debtor_user_id
     INNER JOIN users ru ON ru.id = pt.receiver_user_id
     WHERE pt.group_id = $1
     ORDER BY pt.created_at DESC
     LIMIT 100`,
    [groupId]
  );
  return rows;
}
