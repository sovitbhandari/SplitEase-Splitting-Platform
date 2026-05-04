/** Matches server `buildSettlementKey` — debtorUserId_receiverUserId (UUIDs). */
export function buildSettlementKey(fromUserId: string, toUserId: string): string {
  return `${fromUserId}_${toUserId}`;
}
