export type SplitMode = 'equal' | 'percentage' | 'exact';

export type SplitInput = {
  userId: string;
  value: number | string;
};

export type SplitResult = {
  userId: string;
  amountOwed: number;
  amountOwedCents: number;
  ratio: number;
};

const MAX_PERCENT_SCALE = 4;
const MAX_PERCENT_UNITS = 100 * 10 ** MAX_PERCENT_SCALE;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function parseNonnegativeDecimalToUnits(
  value: number | string,
  scale: number,
  fieldName: string
): number {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be finite`);
  }
  const raw = typeof value === 'number' ? String(value) : value.trim();
  const re = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`);
  if (!re.test(raw)) {
    throw new Error(`${fieldName} has unsupported precision`);
  }
  const [wholePart, fractionalPart = ''] = raw.split('.');
  const whole = Number(wholePart);
  const fractional = Number(fractionalPart.padEnd(scale, '0'));
  const multiplier = 10 ** scale;
  const units = whole * multiplier + fractional;
  if (!Number.isSafeInteger(units)) {
    throw new Error(`${fieldName} is too large`);
  }
  return units;
}

function assertUniqueUsers(splits: SplitInput[]): void {
  const seen = new Set<string>();
  for (const split of splits) {
    if (seen.has(split.userId)) {
      throw new Error('Duplicate split participant');
    }
    seen.add(split.userId);
  }
}

function buildResults(
  amountCents: number,
  shares: Array<{ userId: string; cents: number }>
): SplitResult[] {
  return shares.map((share) => ({
    userId: share.userId,
    amountOwed: share.cents / 100,
    amountOwedCents: share.cents,
    ratio: amountCents === 0 ? 0 : round4(share.cents / amountCents),
  }));
}

export function calculateSplits(
  mode: SplitMode,
  amount: number,
  splits: SplitInput[]
): SplitResult[] {
  if (splits.length === 0) {
    throw new Error('At least one split entry is required');
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Amount must be positive integer cents');
  }
  assertUniqueUsers(splits);

  if (mode === 'equal') {
    const quotient = Math.floor(amount / splits.length);
    let remainder = amount % splits.length;
    const orderedIds = [...splits.map((split) => split.userId)].sort();
    const sharesByUser = new Map<string, number>();
    for (const userId of orderedIds) {
      sharesByUser.set(userId, quotient + (remainder > 0 ? 1 : 0));
      remainder -= 1;
    }
    return buildResults(
      amount,
      splits.map((split) => ({ userId: split.userId, cents: sharesByUser.get(split.userId) ?? 0 }))
    );
  }

  if (mode === 'percentage') {
    const weighted = splits.map((split) => ({
      userId: split.userId,
      units: parseNonnegativeDecimalToUnits(split.value, MAX_PERCENT_SCALE, 'Percentage split'),
    }));
    const totalPercent = weighted.reduce((sum, item) => sum + item.units, 0);
    if (totalPercent !== MAX_PERCENT_UNITS) {
      throw new Error('Percentage splits must add up to 100%');
    }
    const allocations = weighted.map((item) => {
      const numerator = amount * item.units;
      return {
        userId: item.userId,
        cents: Math.floor(numerator / MAX_PERCENT_UNITS),
        remainder: numerator % MAX_PERCENT_UNITS,
      };
    });
    let remainder = amount - allocations.reduce((sum, item) => sum + item.cents, 0);
    const byRemainder = [...allocations].sort(
      (a, b) => b.remainder - a.remainder || a.userId.localeCompare(b.userId)
    );
    for (const item of byRemainder) {
      if (remainder <= 0) {
        break;
      }
      item.cents += 1;
      remainder -= 1;
    }
    const shareByUser = new Map(byRemainder.map((item) => [item.userId, item.cents]));
    return buildResults(
      amount,
      splits.map((split) => ({ userId: split.userId, cents: shareByUser.get(split.userId) ?? 0 }))
    );
  }

  const exact = splits.map((split) => ({
    userId: split.userId,
    cents: parseNonnegativeDecimalToUnits(split.value, 2, 'Exact split'),
  }));
  const totalExact = exact.reduce((sum, item) => sum + item.cents, 0);
  if (totalExact !== amount) {
    throw new Error('Exact splits must add up to total amount');
  }
  return buildResults(amount, exact);
}
