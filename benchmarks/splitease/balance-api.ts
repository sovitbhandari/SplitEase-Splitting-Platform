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

const SEED = process.env.SPLITEASE_BENCH_SEED ?? 'balance-api-v1';
const EXPENSE_LEVELS = (process.env.SPLITEASE_BALANCE_EXPENSES ?? '100,1000,5000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const PARTICIPANTS = Number(process.env.SPLITEASE_BALANCE_PARTICIPANTS ?? 10);
const READS_PER_LEVEL = Number(process.env.SPLITEASE_BALANCE_READS ?? 30);

async function explainPlans(pool: Pool, groupId: string): Promise<Record<string, unknown>[]> {
  const queries = [
    {
      name: 'balance_receivable',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT e.paid_by AS user_id, SUM(es.amount_owed_cents)::text AS amount_receivable
        FROM expense_splits es
        INNER JOIN expenses e ON e.id = es.expense_id
        WHERE es.group_id = $1 AND es.is_settled = false
        GROUP BY e.paid_by`,
    },
    {
      name: 'balance_owed',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT user_id, SUM(amount_owed_cents)::text AS amount_owed
        FROM expense_splits
        WHERE group_id = $1 AND is_settled = false
        GROUP BY user_id`,
    },
  ];
  const plans: Record<string, unknown>[] = [];
  for (const query of queries) {
    const result = await pool.query<{ 'QUERY PLAN': unknown }>(query.sql, [groupId]);
    plans.push({ name: query.name, plan: result.rows[0]?.['QUERY PLAN'] });
  }
  return plans;
}

async function main(): Promise<void> {
  assertBenchmarkDatabase();
  const paths = await prepareRunPaths('splitease-balance-api');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rawRows: Array<Record<string, unknown>> = [];
  const plans: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  try {
    await resetSplitEaseData(pool);
    for (const expenseCount of EXPENSE_LEVELS) {
      await resetSplitEaseData(pool);
      const outsider = await request(getBenchApp())
        .post('/api/auth/register')
        .send({
          email: `balance-outsider-${expenseCount}@bench.local`,
          password: 'password123',
          display_name: 'Balance Outsider',
        })
        .expect(201);
      const group = await createBenchGroup({ label: `balance-${expenseCount}`, memberCount: PARTICIPANTS });
      for (let i = 0; i < expenseCount; i += 1) {
        await createEqualExpense({
          group,
          payerIndex: i % group.users.length,
          amount: ((100 + (i % 900)) / 100).toFixed(2),
          description: `balance expense ${i}`,
        });
      }
      plans.push({ expense_count: expenseCount, participant_count: PARTICIPANTS, plans: await explainPlans(pool, group.groupId) });
      await request(getBenchApp())
        .get(`/api/groups/${group.groupId}/expenses`)
        .set('Authorization', `Bearer ${outsider.body.accessToken}`)
        .expect(404);
      const authCheck = await request(getBenchApp())
        .get(`/api/groups/${group.groupId}/expenses`)
        .set('Authorization', `Bearer ${group.users[0]!.token}`)
        .expect(200);
      if (!Array.isArray(authCheck.body.expenses) || authCheck.body.expenses.length !== expenseCount) {
        throw new Error(`returned page correctness failed for ${expenseCount} expenses`);
      }
      for (let read = 0; read < READS_PER_LEVEL; read += 1) {
        const started = performance.now();
        const response = await request(getBenchApp())
          .get(`/api/groups/${group.groupId}/expenses`)
          .set('Authorization', `Bearer ${group.users[read % group.users.length]!.token}`);
        rawRows.push({
          expense_count: expenseCount,
          read,
          status: response.status,
          elapsed_ms: performance.now() - started,
          returned_expenses: Array.isArray(response.body.expenses) ? response.body.expenses.length : null,
        });
      }
    }
    const rawPath = `${paths.rawDir}/balance-api-latencies.jsonl`;
    const planPath = `${paths.rawDir}/balance-query-plans.json`;
    await writeJsonl(rawPath, rawRows);
    await writeJson(planPath, plans);
    const summary = EXPENSE_LEVELS.map((expenseCount) => {
      const rows = rawRows.filter((row) => row.expense_count === expenseCount);
      return {
        expense_count: expenseCount,
        participant_count: PARTICIPANTS,
        endpoint_latency: summarizeLatency(rows.map((row) => Number(row.elapsed_ms))),
        statuses: rows.reduce<Record<string, number>>((acc, row) => {
          acc[String(row.status)] = (acc[String(row.status)] ?? 0) + 1;
          return acc;
        }, {}),
      };
    });
    await writeJson(`${paths.root}/balance-summary.json`, summary);
    const metadata: Metadata = {
      date: new Date().toISOString(),
      commit: currentCommit(),
      code_changes: currentCodeChanges(),
      versions: collectVersions(),
      os_cpu_ram: osCpuRam(),
      docker_resource_limits: process.env.DOCKER_RESOURCE_LIMITS ?? null,
      app_and_generator_placement: 'Supertest closed-loop client and Express app in one Node process; PostgreSQL external via DATABASE_URL.',
      schema_indexes: await schemaIndexes(pool),
      dataset: { synthetic: true, expense_levels: EXPENSE_LEVELS, participants: PARTICIPANTS },
      workload: { reads_per_level: READS_PER_LEVEL, endpoint: 'GET /api/groups/:groupId/expenses' },
      commands: ['SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 DATABASE_URL=<bench-db> npm run bench:splitease:balances'],
      durations: summary,
      seed: SEED,
      repetitions: 1,
      exclusions: ['No browser rendering measured.', 'Closed-loop endpoint reads are not an RPS capacity guarantee.'],
      raw_artifact_paths: [rel(rawPath), rel(planPath)],
      errors,
      status: 'MEASURED',
      exploratory_or_final: 'exploratory',
      aggregate_calculation: 'Percentiles are per expense level over repeated authenticated endpoint reads after seeding.',
    };
    await writeJson(paths.metadataPath, metadata);
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
