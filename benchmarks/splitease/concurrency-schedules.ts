import request from 'supertest';
import { Pool } from 'pg';
import {
  assertBenchmarkDatabase,
  collectVersions,
  currentCodeChanges,
  currentCommit,
  osCpuRam,
  prepareRunPaths,
  rel,
  schemaIndexes,
  summarizeLatency,
  writeJson,
  writeJsonl,
  type Metadata,
} from '../lib/common';
import { createBenchGroup, createEqualExpense, getBenchApp, resetSplitEaseData } from '../lib/spliteaseDb';

const SEED = process.env.SPLITEASE_BENCH_SEED ?? 'settlement-concurrency-v1';
const REQUEST_LEVELS = (process.env.SPLITEASE_CONCURRENCY_LEVELS ?? '2,10,50')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const REPETITIONS = Number(process.env.SPLITEASE_CONCURRENCY_REPETITIONS ?? 3);

async function runLevel(level: number, repetition: number): Promise<Record<string, unknown>> {
  const group = await createBenchGroup({ label: `concurrency-${level}-${repetition}`, memberCount: 2 });
  const debtor = group.users[0]!;
  const receiver = group.users[1]!;
  await createEqualExpense({
    group,
    payerIndex: 1,
    amount: '100.00',
    description: `concurrency ${level} rep ${repetition}`,
  });
  const path = `/api/groups/${group.groupId}/settlements`;
  const body = {
    fromUserId: debtor.userId,
    toUserId: receiver.userId,
    amount: '50.01',
    method: 'cash',
    note: `synthetic level ${level}`,
  };
  const start = performance.now();
  const responses = await Promise.all(
    Array.from({ length: level }, async (_, index) => {
      const started = performance.now();
      const key = index % 5 === 0 ? `dup-${level}-${repetition}` : `unique-${level}-${repetition}-${index}`;
      try {
        const response = await request(getBenchApp())
          .post(path)
          .set('Authorization', `Bearer ${debtor.token}`)
          .set('Idempotency-Key', key)
          .send(index % 7 === 0 ? { ...body, amount: '49.99' } : body);
        return {
          index,
          status: response.status,
          elapsed_ms: performance.now() - started,
          error: null,
        };
      } catch (error) {
        return {
          index,
          status: 0,
          elapsed_ms: performance.now() - started,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const persisted = await pool.query<{ count: string; total: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount_cents), 0)::text AS total FROM settlements`
    );
    const ledger = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ledger_entries WHERE event_type = 'settlement_created'`
    );
    return {
      level,
      repetition,
      wall_ms: performance.now() - start,
      successes: responses.filter((row) => row.status === 200).length,
      expected_conflicts: responses.filter((row) => row.status === 400 || row.status === 409).length,
      unexpected_errors: responses.filter((row) => row.status >= 500 || row.status === 0).length,
      statuses: responses.reduce<Record<string, number>>((acc, row) => {
        acc[String(row.status)] = (acc[String(row.status)] ?? 0) + 1;
        return acc;
      }, {}),
      latency: summarizeLatency(responses.map((row) => row.elapsed_ms)),
      persisted_settlement_count: Number(persisted.rows[0]?.count ?? 0),
      persisted_settlement_cents: Number(persisted.rows[0]?.total ?? 0),
      ledger_settlement_events: Number(ledger.rows[0]?.count ?? 0),
      responses,
    };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  assertBenchmarkDatabase();
  const paths = await prepareRunPaths('splitease-concurrency');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const errors: string[] = [];
  const results: Array<Record<string, unknown>> = [];
  try {
    await resetSplitEaseData(pool);
    for (const level of REQUEST_LEVELS) {
      for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
        results.push(await runLevel(level, repetition));
        await resetSplitEaseData(pool);
      }
    }
    const rawPath = `${paths.rawDir}/concurrency-results.jsonl`;
    await writeJsonl(rawPath, results);
    const metadata: Metadata = {
      date: new Date().toISOString(),
      commit: currentCommit(),
      code_changes: currentCodeChanges(),
      versions: collectVersions(),
      os_cpu_ram: osCpuRam(),
      docker_resource_limits: process.env.DOCKER_RESOURCE_LIMITS ?? null,
      app_and_generator_placement: 'Supertest closed-loop client and Express app in one Node process; PostgreSQL external via DATABASE_URL.',
      schema_indexes: await schemaIndexes(pool),
      dataset: { synthetic: true, groups_per_repetition: 1, users_per_group: 2 },
      workload: { levels: REQUEST_LEVELS, repetitions: REPETITIONS, includes_duplicate_keys: true, includes_competing_overpayments: true },
      commands: ['SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 DATABASE_URL=<bench-db> npm run bench:splitease:concurrency'],
      durations: results.map((row) => ({ level: row.level, repetition: row.repetition, wall_ms: row.wall_ms })),
      seed: SEED,
      repetitions: REPETITIONS,
      exclusions: ['No live payments or Plaid provider calls.', 'Closed-loop requests are not an RPS capacity guarantee.'],
      raw_artifact_paths: [rel(rawPath)],
      errors,
      status: 'MEASURED',
      exploratory_or_final: 'exploratory',
      aggregate_calculation: 'Summaries are per level and repetition; do not average expected 409 conflicts into corruption.',
    };
    await writeJson(paths.metadataPath, metadata);
    await writeJson(`${paths.root}/concurrency-summary.json`, { results });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await writeJson(paths.metadataPath, {
      date: new Date().toISOString(),
      commit: currentCommit(),
      code_changes: currentCodeChanges(),
      errors,
      status: 'BLOCKED',
    });
    throw error;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
