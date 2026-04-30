export type SplitMode = 'equal' | 'percentage' | 'exact';

export type SplitInput = {
  userId: string;
  value: number;
};

export type SplitResult = {
  userId: string;
  amountOwed: number;
  ratio: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function calculateSplits(
  mode: SplitMode,
  amount: number,
  splits: SplitInput[]
): SplitResult[] {
  if (splits.length === 0) {
    throw new Error('At least one split entry is required');
  }

  if (mode === 'equal') {
    const base = round2(amount / splits.length);
    const results = splits.map((split) => ({
      userId: split.userId,
      amountOwed: base,
      ratio: round4(base / amount),
    }));
    const assigned = round2(results.reduce((sum, item) => sum + item.amountOwed, 0));
    const delta = round2(amount - assigned);
    if (delta !== 0) {
      results[results.length - 1]!.amountOwed = round2(
        results[results.length - 1]!.amountOwed + delta
      );
      results[results.length - 1]!.ratio = round4(
        results[results.length - 1]!.amountOwed / amount
      );
    }
    return results;
  }

  if (mode === 'percentage') {
    const totalPercent = round4(splits.reduce((sum, item) => sum + item.value, 0));
    if (Math.abs(totalPercent - 100) > 0.0001) {
      throw new Error('Percentage splits must add up to 100%');
    }
    const results = splits.map((split) => ({
      userId: split.userId,
      amountOwed: round2((amount * split.value) / 100),
      ratio: round4(split.value / 100),
    }));
    const assigned = round2(results.reduce((sum, item) => sum + item.amountOwed, 0));
    const delta = round2(amount - assigned);
    if (delta !== 0) {
      results[results.length - 1]!.amountOwed = round2(
        results[results.length - 1]!.amountOwed + delta
      );
      results[results.length - 1]!.ratio = round4(
        results[results.length - 1]!.amountOwed / amount
      );
    }
    return results;
  }

  const totalExact = round2(splits.reduce((sum, item) => sum + item.value, 0));
  if (Math.abs(totalExact - round2(amount)) > 0.009) {
    throw new Error('Exact splits must add up to total amount');
  }
  return splits.map((split) => ({
    userId: split.userId,
    amountOwed: round2(split.value),
    ratio: round4(split.value / amount),
  }));
}
