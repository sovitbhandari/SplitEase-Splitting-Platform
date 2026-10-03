import { calculateSplits, type SplitInput, type SplitMode } from '../../server/src/utils/splitCalculator';
import {
  Lcg,
  appendMarkdown,
  collectVersions,
  currentCodeChanges,
  currentCommit,
  osCpuRam,
  prepareRunPaths,
  rel,
  summarizeLatency,
  writeJson,
  writeJsonl,
  type Metadata,
} from '../lib/common';

type CaseRow = {
  case_id: number;
  generated_valid: boolean;
  mode: SplitMode;
  total_cents: number;
  participant_count: number;
  passed: boolean;
  error: string | null;
  elapsed_ms: number;
};

const SEED = Number(process.env.SPLITEASE_BENCH_SEED ?? 0x5eed2026);
const CASES = Number(process.env.SPLITEASE_ALLOCATION_CASES ?? 10_000);
const PROPERTY_CASES = Number(process.env.SPLITEASE_PROPERTY_CASES ?? 2_000);

function id(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function equalCase(rng: Lcg, participantCount: number): SplitInput[] {
  return Array.from({ length: participantCount }, (_, index) => ({ userId: id(index + 1), value: rng.int(0, 10) }));
}

function percentageCase(participantCount: number): SplitInput[] {
  const base = Math.floor(10000 / participantCount);
  let remainder = 10000 - base * participantCount;
  return Array.from({ length: participantCount }, (_, index) => {
    const units = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { userId: id(index + 1), value: (units / 100).toFixed(2) };
  });
}

function exactCase(totalCents: number, participantCount: number): SplitInput[] {
  const quotient = Math.floor(totalCents / participantCount);
  let remainder = totalCents % participantCount;
  return Array.from({ length: participantCount }, (_, index) => {
    const cents = quotient + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { userId: id(index + 1), value: (cents / 100).toFixed(2) };
  });
}

function generatedCase(rng: Lcg, caseId: number): {
  valid: boolean;
  mode: SplitMode;
  totalCents: number;
  splits: SplitInput[];
} {
  const mode = rng.pick<SplitMode>(['equal', 'percentage', 'exact']);
  const participantCount = rng.int(1, 12);
  const totalCents = rng.int(1, 250_000);
  const valid = caseId % 7 !== 0;
  let splits =
    mode === 'equal'
      ? equalCase(rng, participantCount)
      : mode === 'percentage'
        ? percentageCase(participantCount)
        : exactCase(totalCents, participantCount);
  if (!valid) {
    const invalidKind = caseId % 4;
    if (invalidKind === 0) {
      splits = [...splits, { ...splits[0]! }];
    } else if (invalidKind === 1) {
      splits = splits.map((split, index) => index === 0 ? { ...split, value: '-1' } : split);
    } else if (invalidKind === 2 && mode === 'exact') {
      splits = splits.map((split, index) => index === 0 ? { ...split, value: '0.001' } : split);
    } else if (mode === 'percentage') {
      splits = splits.map((split, index) => index === 0 ? { ...split, value: '99.99999' } : split);
    } else {
      splits = [];
    }
  }
  return { valid, mode, totalCents, splits };
}

function assertResult(
  mode: SplitMode,
  totalCents: number,
  splits: SplitInput[],
  result: ReturnType<typeof calculateSplits>
): void {
  const sum = result.reduce((acc, split) => acc + split.amountOwedCents, 0);
  if (sum !== totalCents) {
    throw new Error(`cent conservation failed: ${sum} !== ${totalCents}`);
  }
  if (result.some((split) => split.amountOwedCents < 0)) {
    throw new Error('negative allocation');
  }
  const reversed = calculateSplits(mode, totalCents, [...splits].reverse());
  if (splits.length > 0 && result.length === reversed.length) {
    const a = new Map(result.map((split) => [split.userId, split.amountOwedCents]));
    const b = new Map(reversed.map((split) => [split.userId, split.amountOwedCents]));
    for (const [userId, cents] of a) {
      if (b.get(userId) !== cents) {
        throw new Error(`equal allocation is not stable for ${userId}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const paths = await prepareRunPaths('splitease-allocation');
  const rng = new Lcg(SEED);
  const rows: CaseRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < CASES + PROPERTY_CASES; i += 1) {
    const c = generatedCase(rng, i);
    const start = performance.now();
    let passed = false;
    let error: string | null = null;
    try {
      const result = calculateSplits(c.mode, c.totalCents, c.splits);
      if (!c.valid) {
        throw new Error('invalid generated case unexpectedly accepted');
      }
      assertResult(c.mode, c.totalCents, c.splits, result);
      passed = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      passed = !c.valid;
      if (!passed) errors.push(`case ${i}: ${error}`);
    }
    rows.push({
      case_id: i,
      generated_valid: c.valid,
      mode: c.mode,
      total_cents: c.totalCents,
      participant_count: c.splits.length,
      passed,
      error,
      elapsed_ms: performance.now() - start,
    });
  }

  const rawPath = `${paths.rawDir}/allocation-results.jsonl`;
  await writeJsonl(rawPath, rows);
  const valid = rows.filter((row) => row.generated_valid);
  const invalid = rows.filter((row) => !row.generated_valid);
  const summary = {
    run_id: paths.runId,
    status: errors.length === 0 ? 'MEASURED' : 'BLOCKED',
    seed: SEED,
    deterministic_cases: CASES,
    property_cases: PROPERTY_CASES,
    valid_cases: valid.length,
    invalid_cases: invalid.length,
    passed_cases: rows.filter((row) => row.passed).length,
    failed_cases: rows.filter((row) => !row.passed).length,
    latency: summarizeLatency(rows.map((row) => row.elapsed_ms)),
    raw_path: rel(rawPath),
    errors: errors.slice(0, 20),
  };
  const summaryPath = `${paths.root}/allocation-summary.json`;
  await writeJson(summaryPath, summary);

  const metadata: Metadata = {
    date: new Date().toISOString(),
    commit: currentCommit(),
    code_changes: currentCodeChanges(),
    versions: collectVersions(),
    os_cpu_ram: osCpuRam(),
    docker_resource_limits: null,
    app_and_generator_placement: 'Node benchmark client in the local workspace; no server process required.',
    schema_indexes: [],
    dataset: { synthetic: true, deterministic_cases: CASES, property_cases: PROPERTY_CASES },
    workload: 'SplitEase allocation correctness harness; not financial transactions.',
    commands: ['npm run bench:splitease:allocation'],
    durations: summary.latency,
    seed: SEED,
    repetitions: 1,
    exclusions: ['No database/API latency measured by this allocation-only harness.'],
    raw_artifact_paths: [rel(rawPath), rel(summaryPath)],
    errors,
    status: errors.length === 0 ? 'MEASURED' : 'BLOCKED',
    exploratory_or_final: 'exploratory',
    aggregate_calculation: 'Percentiles are computed over per-case in-process calculation elapsed milliseconds.',
  };
  await writeJson(paths.metadataPath, metadata);

  await appendMarkdown(
    'docs/benchmarks/results.md',
    `## ${paths.runId} - SplitEase Allocation Correctness

Status: ${metadata.status}

- Seed: \`${SEED}\`
- Valid generated cases: ${summary.valid_cases}
- Invalid generated cases: ${summary.invalid_cases}
- Passed cases: ${summary.passed_cases}
- Failed cases: ${summary.failed_cases}
- Latency summary is for local in-process allocation checks only: p50 ${summary.latency.p50_ms?.toFixed(4)} ms, p95 ${summary.latency.p95_ms?.toFixed(4)} ms, p99 ${summary.latency.p99_ms?.toFixed(4)} ms.
- Raw artifacts: \`${rel(rawPath)}\`, \`${rel(summaryPath)}\`, \`${rel(paths.metadataPath)}\`

This is correctness testing, not 10k successful financial transactions.`
  );

  await appendMarkdown(
    'docs/benchmarks/resume-candidates.md',
    `## SplitEase Allocation Candidate (${paths.runId})

Status: ${metadata.status}

- Candidate numerical bullet: Validated SplitEase cent allocation over ${summary.valid_cases} valid and ${summary.invalid_cases} invalid local synthetic cases using seed \`${SEED}\`, with zero harness-detected conservation or determinism failures.
- Qualifier: local synthetic allocation correctness harness; no API latency, production traffic, or real financial transactions measured.`
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
