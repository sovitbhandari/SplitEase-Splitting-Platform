CREATE TABLE IF NOT EXISTS idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  http_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  UNIQUE (actor_user_id, group_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires_at
  ON idempotency_records (expires_at);

CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key)
);

ALTER TABLE payment_transfers
  ADD COLUMN IF NOT EXISTS request_hash text;

CREATE INDEX IF NOT EXISTS payment_transfers_idempotency_lookup
  ON payment_transfers (initiated_by_user_id, group_id, idempotency_key);

CREATE TABLE IF NOT EXISTS balance_update_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_balance_update_outbox_pending
  ON balance_update_outbox (created_at)
  WHERE delivered_at IS NULL;
