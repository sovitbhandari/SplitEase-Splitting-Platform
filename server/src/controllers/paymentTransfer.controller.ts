import type { Request, Response } from 'express';
import { z } from 'zod';
import { computeGroupDebts } from '../utils/debtEngine';
import {
  hasPendingLikeTransfer,
  findPaymentTransferByIdempotency,
  listPaymentTransfersForGroup,
} from '../models/paymentTransfer.model';
import { getAccountsByUser } from '../models/plaid.model';
import {
  requireCurrentGroupMember,
  requireHistoricalGroupParticipant,
} from '../models/groupAccess.model';
import {
  buildTransferRequestHash,
  createAuthorizedTransfer,
} from '../services/plaidTransferService';
import { parseSettlementKey } from '../utils/settlementKey';
import { dollarsToCents, parseUsdCents } from '../utils/money';
import { isPlaidTransferFeatureEnabled, shouldLabelAsSandboxTransfer } from '../utils/plaidClient';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

export async function getPaymentMethodsHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  const rows = await getAccountsByUser(userId);
  const transferEnabled = isPlaidTransferFeatureEnabled();
  res.status(200).json({
    accounts: rows.map((row) => ({
      id: row.id,
      plaidAccountId: row.plaid_account_id,
      accountName: row.name,
      mask: row.mask,
      institutionName: 'Linked institution',
      subtype: row.account_subtype ?? '',
      type: row.account_type,
    })),
    transferAvailable: transferEnabled,
    sandboxCopy: shouldLabelAsSandboxTransfer(),
  });
}

const previewSchema = z.object({
  fromPlaidAccountId: z.string().uuid(),
  amount: z.union([z.number().finite().positive(), z.string().min(1)]),
});

export async function previewTransferHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  const settlementId = req.params.settlementId;
  const parsedBody = previewSchema.safeParse(req.body);
  if (!groupId || !settlementId) {
    res.status(400).json({ error: 'Group or settlement is required' });
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Validation failed', details: parsedBody.error.flatten() });
    return;
  }

  const pair = parseSettlementKey(settlementId);
  if (!pair) {
    res.status(400).json({ error: 'Invalid settlement id' });
    return;
  }

  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  if (userId !== pair.fromUserId) {
    res.status(403).json({ error: 'Only the person who owes money can start this payment.' });
    return;
  }
  const receiverAccess = await requireHistoricalGroupParticipant(groupId, pair.toUserId);
  if (!receiverAccess.ok) {
    res.status(receiverAccess.status).json({ error: receiverAccess.error });
    return;
  }

  let reqCents: number;
  try {
    reqCents = parseUsdCents(parsedBody.data.amount, 'amount');
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid amount' });
    return;
  }

  if (!isPlaidTransferFeatureEnabled()) {
    res.status(200).json({
      canTransfer: false,
      amount: reqCents / 100,
      currency: 'USD',
      debtorName: '',
      receiverName: '',
      estimatedTimeline: null,
      message: 'Sandbox bank payments are not enabled. Use manual settlement or enable ENABLE_PLAID_TRANSFER_SANDBOX with Plaid credentials.',
    });
    return;
  }

  const debts = await computeGroupDebts(groupId);
  const line = debts.find(
    (d) => d.fromUserId === pair.fromUserId && d.toUserId === pair.toUserId
  );
  if (!line) {
    res.status(404).json({ error: 'Settlement not found for this group' });
    return;
  }

  const owedCents = dollarsToCents(line.amount);
  if (BigInt(reqCents) > owedCents) {
    res.status(200).json({
      canTransfer: false,
      amount: reqCents / 100,
      currency: 'USD',
      debtorName: line.fromUserName,
      receiverName: line.toUserName,
      estimatedTimeline: null,
      message: 'Amount cannot exceed the current settlement balance.',
    });
    return;
  }

  const pending = await hasPendingLikeTransfer(groupId, settlementId);
  if (pending) {
    res.status(200).json({
      canTransfer: false,
      amount: reqCents / 100,
      currency: 'USD',
      debtorName: line.fromUserName,
      receiverName: line.toUserName,
      estimatedTimeline: null,
      message: 'A payment is already pending for this settlement.',
    });
    return;
  }

  const accounts = await getAccountsByUser(userId);
  const match = accounts.find((a) => a.id === parsedBody.data.fromPlaidAccountId);
  if (!match) {
    res.status(200).json({
      canTransfer: false,
      amount: reqCents / 100,
      currency: 'USD',
      debtorName: line.fromUserName,
      receiverName: line.toUserName,
      estimatedTimeline: null,
      message: 'This bank account is not available for transfers.',
    });
    return;
  }

  res.status(200).json({
    canTransfer: true,
    amount: reqCents / 100,
    currency: 'USD',
    debtorName: line.fromUserName,
    receiverName: line.toUserName,
    estimatedTimeline: shouldLabelAsSandboxTransfer()
      ? 'Sandbox: simulated ACH timing (no real money movement).'
      : 'Depends on ACH / RTP network timing.',
    message: shouldLabelAsSandboxTransfer()
      ? 'This simulates ACH settlement using Plaid Sandbox. No real money is moved.'
      : 'Funds movement follows Plaid Transfer status updates.',
  });
}

const createSchema = z.object({
  fromPlaidAccountId: z.string().uuid(),
  amount: z.union([z.number().finite().positive(), z.string().min(1)]),
  note: z.string().max(500).optional(),
});

export async function createTransferHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  const settlementId = req.params.settlementId;
  const parsedBody = createSchema.safeParse(req.body);
  if (!groupId || !settlementId) {
    res.status(400).json({ error: 'Group or settlement is required' });
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Validation failed', details: parsedBody.error.flatten() });
    return;
  }

  const pair = parseSettlementKey(settlementId);
  if (!pair) {
    res.status(400).json({ error: 'Invalid settlement id' });
    return;
  }

  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  if (userId !== pair.fromUserId) {
    res.status(403).json({ error: 'Only the person who owes money can start this payment.' });
    return;
  }
  const receiverAccess = await requireHistoricalGroupParticipant(groupId, pair.toUserId);
  if (!receiverAccess.ok) {
    res.status(receiverAccess.status).json({ error: receiverAccess.error });
    return;
  }

  if (!isPlaidTransferFeatureEnabled()) {
    res.status(503).json({ error: 'Plaid Transfer is not enabled on this server.' });
    return;
  }

  const debts = await computeGroupDebts(groupId);
  const line = debts.find(
    (d) => d.fromUserId === pair.fromUserId && d.toUserId === pair.toUserId
  );
  if (!line) {
    res.status(404).json({ error: 'Settlement not found' });
    return;
  }

  let reqCents: number;
  try {
    reqCents = parseUsdCents(parsedBody.data.amount, 'amount');
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid amount' });
    return;
  }
  const owedCents = dollarsToCents(line.amount);
  if (BigInt(reqCents) > owedCents) {
    res.status(400).json({ error: 'Amount cannot exceed the current settlement amount.' });
    return;
  }

  const pending = await hasPendingLikeTransfer(groupId, settlementId);
  if (pending) {
    res.status(409).json({ error: 'A payment is already pending for this settlement.' });
    return;
  }

  const idem =
    typeof req.headers['idempotency-key'] === 'string'
      ? req.headers['idempotency-key'].trim()
      : '';
  if (!idem) {
    res.status(428).json({ error: 'Idempotency-Key header is required for transfer retries.' });
    return;
  }
  const requestHash = buildTransferRequestHash({
    groupId,
    settlementKey: settlementId,
    debtorUserId: pair.fromUserId,
    receiverUserId: pair.toUserId,
    internalAccountId: parsedBody.data.fromPlaidAccountId,
    amountCents: reqCents,
    note: parsedBody.data.note ?? null,
  });
  const prior = await findPaymentTransferByIdempotency({
    initiatedByUserId: userId,
    groupId,
    idempotencyKey: idem,
  });
  if (prior) {
    if (prior.request_hash !== requestHash) {
      res.status(409).json({ error: 'Idempotency-Key was already used with a different request payload.' });
      return;
    }
    res.status(201).json({
      id: prior.id,
      plaidTransferId: prior.plaid_transfer_id,
      sandbox: shouldLabelAsSandboxTransfer(),
    });
    return;
  }

  let result;
  try {
    result = await createAuthorizedTransfer({
      userId,
      groupId,
      settlementKey: settlementId,
      debtorUserId: pair.fromUserId,
      receiverUserId: pair.toUserId,
      internalAccountId: parsedBody.data.fromPlaidAccountId,
      amountDollars: reqCents / 100,
      note: parsedBody.data.note ?? null,
      idempotencyKey: idem,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Duplicate transfer request.' });
      return;
    }
    throw err;
  }

  if (!result.ok) {
    const status =
      result.code === 'authorization_declined' || result.code === 'no_account' ? 400
        : result.code === 'idempotency_conflict' ? 409
          : result.code === 'transfer_pending' ? 409
            : 502;
    res.status(status).json({ error: result.message, code: result.code, paymentTransferId: result.paymentTransferId });
    return;
  }

  res.status(201).json({
    id: result.paymentTransferId,
    plaidTransferId: result.plaidTransferId,
    sandbox: shouldLabelAsSandboxTransfer(),
  });
}

export async function listGroupTransfersHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }

  const rows = await listPaymentTransfersForGroup(groupId);
  res.status(200).json({
    transfers: rows.map((row) => ({
      id: row.id,
      settlementKey: row.settlement_key,
      amount: Number(row.amount_cents) / 100,
      status: row.status,
      debtorName: row.debtor_name,
      receiverName: row.receiver_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      note: row.note,
      method:
        row.plaid_transfer_id || row.plaid_authorization_id ? 'sandbox_bank' : 'manual',
      settlementApplied: row.settlement_applied,
    })),
  });
}
