const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildSettlementKey(fromUserId: string, toUserId: string): string {
  return `${fromUserId}_${toUserId}`;
}

export function parseSettlementKey(key: string): { fromUserId: string; toUserId: string } | null {
  const idx = key.indexOf('_');
  if (idx <= 0) {
    return null;
  }
  const fromUserId = key.slice(0, idx);
  const toUserId = key.slice(idx + 1);
  if (!UUID_RE.test(fromUserId) || !UUID_RE.test(toUserId)) {
    return null;
  }
  return { fromUserId, toUserId };
}
