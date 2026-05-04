CREATE TABLE IF NOT EXISTS payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  settlement_key TEXT NOT NULL,
  debtor_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  receiver_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  initiated_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  debtor_plaid_item_id UUID REFERENCES plaid_items (id) ON DELETE SET NULL,
  debtor_internal_account_id UUID REFERENCES accounts (id) ON DELETE SET NULL,
  debtor_plaid_account_id TEXT NOT NULL,
  receiver_plaid_item_id UUID REFERENCES plaid_items (id) ON DELETE SET NULL,
  receiver_plaid_account_id TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  plaid_transfer_id TEXT,
  plaid_authorization_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending_authorization',
      'authorized',
      'pending',
      'posted',
      'failed',
      'cancelled',
      'returned',
      'settled_manually'
    )
  ),
  failure_code TEXT,
  failure_reason TEXT,
  note TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  settlement_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transfers_group_created
  ON payment_transfers (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transfers_plaid_transfer_id
  ON payment_transfers (plaid_transfer_id)
  WHERE plaid_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transfers_group_settlement
  ON payment_transfers (group_id, settlement_key);
