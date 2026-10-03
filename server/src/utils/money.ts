export const SUPPORTED_CURRENCY = 'USD';
export const MINOR_UNITS = 2;
export const MAX_SAFE_CENTS = 999_999_999_999;

export type MoneyInput = number | string;

export function parseUsdCents(value: MoneyInput, fieldName = 'amount'): number {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite USD amount`);
  }
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldName} must be a USD amount with at most 2 decimal places`);
  }
  const [dollarsPart, centsPart = ''] = raw.split('.');
  const dollars = Number(dollarsPart);
  const cents = Number(centsPart.padEnd(2, '0'));
  const total = dollars * 100 + cents;
  if (!Number.isSafeInteger(total) || total > MAX_SAFE_CENTS) {
    throw new Error(`${fieldName} exceeds the supported maximum USD amount`);
  }
  return total;
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Convert decimal dollars to integer cents after strict USD/two-decimal validation. */
export function dollarsToCents(amount: MoneyInput): bigint {
  try {
    return BigInt(parseUsdCents(amount));
  } catch {
    return BigInt(0);
  }
}

export function centsToDecimalString(cents: bigint): string {
  const n = Number(cents);
  return (n / 100).toFixed(2);
}

export function centsNumberToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}
