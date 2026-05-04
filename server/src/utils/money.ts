/** Convert decimal dollars to integer cents (half-up). */
export function dollarsToCents(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    return BigInt(0);
  }
  const cents = Math.round(amount * 100);
  return BigInt(Math.max(1, cents));
}

export function centsToDecimalString(cents: bigint): string {
  const n = Number(cents);
  return (n / 100).toFixed(2);
}
