import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { canonicalize } from '../utils/canonicalJson';

export type IdempotentResult<T> =
  | { kind: 'replay'; httpStatus: number; body: T }
  | { kind: 'conflict'; httpStatus: 409; body: { error: string } }
  | { kind: 'created'; recordId: string; requestHash: string };

export function hashCanonicalRequest(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalize(value)).digest('hex');
}

export async function beginIdempotentOperation<T>(input: {
  client: PoolClient;
  actorUserId: string;
  groupId: string;
  operation: string;
  idempotencyKey: string;
  requestBody: unknown;
}): Promise<IdempotentResult<T>> {
  const requestHash = hashCanonicalRequest(input.requestBody);
  const inserted = await input.client.query<{ id: string }>(
    `INSERT INTO idempotency_records (
       actor_user_id, group_id, operation, idempotency_key, request_hash, status
     )
     VALUES ($1, $2, $3, $4, $5, 'in_progress')
     ON CONFLICT (actor_user_id, group_id, operation, idempotency_key) DO NOTHING
     RETURNING id`,
    [
      input.actorUserId,
      input.groupId,
      input.operation,
      input.idempotencyKey,
      requestHash,
    ]
  );
  if (inserted.rows[0]) {
    return { kind: 'created', recordId: inserted.rows[0].id, requestHash };
  }

  const existing = await input.client.query<{
    id: string;
    request_hash: string;
    status: 'in_progress' | 'completed';
    http_status: number | null;
    response_body: T | null;
  }>(
    `SELECT id, request_hash, status, http_status, response_body
     FROM idempotency_records
     WHERE actor_user_id = $1
       AND group_id = $2
       AND operation = $3
       AND idempotency_key = $4
     FOR UPDATE`,
    [input.actorUserId, input.groupId, input.operation, input.idempotencyKey]
  );
  const row = existing.rows[0];
  if (!row) {
    throw new Error('Idempotency record disappeared');
  }
  if (row.request_hash !== requestHash) {
    return {
      kind: 'conflict',
      httpStatus: 409,
      body: { error: 'Idempotency-Key was already used with a different request payload.' },
    };
  }
  if (row.status === 'completed' && row.http_status && row.response_body) {
    return { kind: 'replay', httpStatus: row.http_status, body: row.response_body };
  }
  throw new Error('Idempotency operation is still in progress');
}

export async function completeIdempotentOperation(input: {
  client: PoolClient;
  recordId: string;
  httpStatus: number;
  responseBody: unknown;
}): Promise<void> {
  await input.client.query(
    `UPDATE idempotency_records
     SET status = 'completed',
         http_status = $2,
         response_body = $3::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [input.recordId, input.httpStatus, JSON.stringify(input.responseBody)]
  );
}
