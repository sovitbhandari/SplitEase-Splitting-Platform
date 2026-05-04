import type { GroupTransferRow } from '../api/paymentTransfers';

const BLOCKING_STATUSES = new Set([
  'pending_authorization',
  'authorized',
  'pending',
  'posted',
]);

export function latestTransferForSettlementKey(
  transfers: GroupTransferRow[],
  settlementKey: string
): GroupTransferRow | undefined {
  const matches = transfers.filter((t) => t.settlementKey === settlementKey);
  if (matches.length === 0) {
    return undefined;
  }
  return matches.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

export function isBlockingPlaidTransfer(transfer: GroupTransferRow | undefined): boolean {
  if (!transfer || transfer.method !== 'sandbox_bank') {
    return false;
  }
  if (transfer.settlementApplied) {
    return false;
  }
  return BLOCKING_STATUSES.has(transfer.status);
}

export function sandboxTransferBadgeLabel(transfer: GroupTransferRow | undefined): string | null {
  if (!transfer || transfer.method !== 'sandbox_bank') {
    return null;
  }
  if (transfer.settlementApplied && transfer.status === 'posted') {
    return 'Payment posted';
  }
  switch (transfer.status) {
    case 'pending_authorization':
    case 'authorized':
    case 'pending':
    case 'posted':
      return 'Pending bank payment';
    case 'failed':
      return 'Payment failed';
    case 'returned':
      return 'Returned';
    case 'cancelled':
      return 'Payment cancelled';
    default:
      return null;
  }
}
