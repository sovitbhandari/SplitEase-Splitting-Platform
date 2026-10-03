import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { execFileSync } from 'child_process';
import os from 'os';
import { Pool } from 'pg';

export type BenchStatus = 'PLANNED' | 'CODE-SUPPORTED' | 'MEASURED' | 'BLOCKED';

export type RunPaths = {
  runId: string;
  root: string;
  rawDir: string;
  metadataPath: string;
};

export type Metadata = {
  date: string;
  commit: string;
  code_changes: string;
  versions: Record<string, string>;
  os_cpu_ram: {
    platform: string;
    release: string;
    arch: string;
    cpus: string[];
    total_ram_bytes: number;
  };
  docker_resource_limits: string | null;
  app_and_generator_placement: string;
  schema_indexes: string[];
  dataset: unknown;
  workload: unknown;
  commands: string[];
  durations: unknown;
  seed: string | number;
  repetitions: number;
  exclusions: string[];
  raw_artifact_paths: string[];
  errors: string[];
  status: BenchStatus;
  exploratory_or_final: 'exploratory' | 'final';
  aggregate_calculation: string;
};

export class Lcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new Error('Cannot pick from an empty array');
    return item;
  }
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? null;
}

export function summarizeLatency(values: number[]): {
  count: number;
  min_ms: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  max_ms: number | null;
} {
  return {
    count: values.length,
    min_ms: values.length ? Math.min(...values) : null,
    p50_ms: percentile(values, 50),
    p95_ms: percentile(values, 95),
    p99_ms: percentile(values, 99),
    max_ms: values.length ? Math.max(...values) : null,
  };
}

export async function prepareRunPaths(name: string): Promise<RunPaths> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `${stamp}-${name}`;
  const root = join(process.cwd(), 'docs', 'benchmarks', 'runs', runId);
  const rawDir = join(root, 'raw');
  await mkdir(rawDir, { recursive: true });
  return {
    runId,
    root,
    rawDir,
    metadataPath: join(root, 'metadata.json'),
  };
}

function capture(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return error instanceof Error ? `unavailable: ${error.message}` : 'unavailable';
  }
}

export function collectVersions(): Record<string, string> {
  return {
    node: process.version,
    npm: capture('npm', ['--version']),
    postgres_client: capture('psql', ['--version']),
    docker: capture('docker', ['--version']),
  };
}

export function currentCommit(): string {
  return capture('git', ['rev-parse', 'HEAD']);
}

export function currentCodeChanges(): string {
  return capture('git', ['status', '--short']);
}

export function osCpuRam(): Metadata['os_cpu_ram'] {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: Array.from(new Set(os.cpus().map((cpu) => cpu.model))),
    total_ram_bytes: os.totalmem(),
  };
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeJsonl(path: string, rows: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

export async function appendMarkdown(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    existing = '';
  }
  await writeFile(path, `${existing}${existing ? '\n' : ''}${content.trim()}\n`, 'utf8');
}

export async function schemaIndexes(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string; indexname: string; indexdef: string }>(
    `SELECT tablename AS table_name, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY tablename, indexname`
  );
  return rows.map((row) => `${row.table_name}.${row.indexname}: ${row.indexdef}`);
}

export function assertBenchmarkDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for this benchmark.');
  }
  if (process.env.SPLITEASE_BENCH_ALLOW_DESTRUCTIVE !== '1') {
    throw new Error('Set SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 to allow benchmark data reset.');
  }
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!/(bench|benchmark|test|perf)/i.test(database)) {
    throw new Error(
      `Refusing destructive benchmark reset for database "${database}". Use a disposable benchmark/test database.`
    );
  }
}

export function rel(path: string): string {
  return relative(process.cwd(), path);
}
