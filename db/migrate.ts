import { config } from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';

config({ path: join(process.cwd(), 'server/.env') });

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === '') {
    throw new Error('DATABASE_URL is required (copy server/.env.example to server/.env)');
  }

  const pool = new Pool({ connectionString: url });
  try {
    await ensureMigrationsTable(pool);
    const applied = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const done = new Set(applied.rows.map((r) => r.version));

    const migrationsDir = join(process.cwd(), 'db', 'migrations');
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      if (done.has(file)) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
