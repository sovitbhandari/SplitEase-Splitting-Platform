import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === '') {
    throw new Error('DATABASE_URL is not set');
  }
  pool = new Pool({ connectionString });
  return pool;
}

function isPgError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<{ rows: R[]; rowCount: number }> {
  try {
    const result = await getPool().query<R>(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (err: unknown) {
    if (isPgError(err)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Database query failed: ${message}`);
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
