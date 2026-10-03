import { calculateSplits, type SplitInput, type SplitMode } from '../utils/splitCalculator';

const U = {
  a: '00000000-0000-0000-0000-000000000001',
  b: '00000000-0000-0000-0000-000000000002',
  c: '00000000-0000-0000-0000-000000000003',
  d: '00000000-0000-0000-0000-000000000004',
  e: '00000000-0000-0000-0000-000000000005',
};

function centsByUser(mode: SplitMode, amountCents: number, splits: SplitInput[]): Map<string, number> {
  const result = calculateSplits(mode, amountCents, splits);
  return new Map(result.map((item) => [item.userId, item.amountOwedCents]));
}

function expectInvariants(mode: SplitMode, amountCents: number, splits: SplitInput[]): void {
  const result = calculateSplits(mode, amountCents, splits);
  expect(result.every((item) => item.amountOwedCents >= 0)).toBe(true);
  expect(result.reduce((sum, item) => sum + item.amountOwedCents, 0)).toBe(amountCents);
  expect(result.every((item) => Number.isInteger(item.amountOwedCents))).toBe(true);
}

describe('calculateSplits exact money allocation', () => {
  it('reproduces tiny equal split edge cases without negative shares', () => {
    expect(Array.from(centsByUser('equal', 3, Object.values(U).map((userId) => ({ userId, value: 1 }))).values()).sort()).toEqual([
      0, 0, 1, 1, 1,
    ]);
    expect(Array.from(centsByUser('equal', 1, [U.a, U.b, U.c].map((userId) => ({ userId, value: 1 }))).values()).sort()).toEqual([
      0, 0, 1,
    ]);
    expect(Array.from(centsByUser('equal', 2, Object.values(U).slice(0, 4).map((userId) => ({ userId, value: 1 }))).values()).sort()).toEqual([
      0, 0, 1, 1,
    ]);
  });

  it('uses stable user-id ordering independent of input permutation', () => {
    const forward = centsByUser('equal', 5, [U.d, U.a, U.c, U.b].map((userId) => ({ userId, value: 1 })));
    const reverse = centsByUser('equal', 5, [U.b, U.c, U.a, U.d].map((userId) => ({ userId, value: 1 })));
    expect(forward).toEqual(reverse);
    expect(forward.get(U.a)).toBe(2);
    expect(forward.get(U.b)).toBe(1);
    expect(forward.get(U.c)).toBe(1);
    expect(forward.get(U.d)).toBe(1);
  });

  it('allocates percentage splits by largest remainder with deterministic ties', () => {
    const result = centsByUser('percentage', 1, [
      { userId: U.b, value: '50.0000' },
      { userId: U.a, value: '50.0000' },
    ]);
    expect(result.get(U.a)).toBe(1);
    expect(result.get(U.b)).toBe(0);
  });

  it('accepts exact zero shares when totals match exactly', () => {
    expect(centsByUser('exact', 3, [
      { userId: U.a, value: '0' },
      { userId: U.b, value: '0.01' },
      { userId: U.c, value: '0.02' },
    ])).toEqual(new Map([
      [U.a, 0],
      [U.b, 1],
      [U.c, 2],
    ]));
  });

  it('rejects duplicates, unsupported precision, negative values, NaN, and invalid totals', () => {
    expect(() => calculateSplits('equal', 10, [
      { userId: U.a, value: 1 },
      { userId: U.a, value: 1 },
    ])).toThrow('Duplicate split participant');
    expect(() => calculateSplits('exact', 1, [{ userId: U.a, value: '0.001' }])).toThrow(
      'unsupported precision'
    );
    expect(() => calculateSplits('percentage', 1, [{ userId: U.a, value: '100.00001' }])).toThrow(
      'unsupported precision'
    );
    expect(() => calculateSplits('exact', 1, [{ userId: U.a, value: '-0.01' }])).toThrow(
      'unsupported precision'
    );
    expect(() => calculateSplits('percentage', 1, [{ userId: U.a, value: Number.NaN }])).toThrow(
      'must be finite'
    );
    expect(() => calculateSplits('exact', 2, [
      { userId: U.a, value: '0.01' },
      { userId: U.b, value: '0.02' },
    ])).toThrow('Exact splits must add up to total amount');
  });

  it('preserves invariants for deterministic generated cases', () => {
    let state = 0x5eedeed;
    const next = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state;
    };

    for (let i = 0; i < 200; i += 1) {
      const userCount = 1 + (next() % 5);
      const amountCents = 1 + (next() % 100_000);
      const users = Object.values(U).slice(0, userCount);
      expectInvariants('equal', amountCents, users.map((userId) => ({ userId, value: 1 })));

      const weights = users.map((userId, index) => ({
        userId,
        value: index === users.length - 1 ? 0 : 1 + (next() % 10_000),
      }));
      const subtotal = weights.slice(0, -1).reduce((sum, item) => sum + Number(item.value), 0);
      weights[weights.length - 1]!.value = 1_000_000 - subtotal;
      if (Number(weights[weights.length - 1]!.value) >= 0) {
        expectInvariants(
          'percentage',
          amountCents,
          weights.map((item) => ({
            userId: item.userId,
            value: (Number(item.value) / 10_000).toFixed(4),
          }))
        );
      }
    }
  });
});
