ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT;

ALTER TABLE expense_splits
  ADD COLUMN IF NOT EXISTS original_amount_owed_cents BIGINT,
  ADD COLUMN IF NOT EXISTS amount_owed_cents BIGINT;

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT;

CREATE TABLE IF NOT EXISTS money_migration_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

UPDATE expenses
SET amount_cents = (amount * 100)::bigint
WHERE amount_cents IS NULL;

UPDATE expense_splits
SET
  original_amount_owed_cents = (amount_owed * 100)::bigint,
  amount_owed_cents = (amount_owed * 100)::bigint
WHERE original_amount_owed_cents IS NULL
   OR amount_owed_cents IS NULL;

UPDATE settlements
SET amount_cents = (amount * 100)::bigint
WHERE amount_cents IS NULL;

INSERT INTO money_migration_anomalies (anomaly_type, entity_type, entity_id, details)
SELECT
  'split_sum_mismatch',
  'expense',
  e.id,
  jsonb_build_object(
    'expense_amount_cents', e.amount_cents,
    'split_original_amount_cents_sum', COALESCE(SUM(es.original_amount_owed_cents), 0),
    'reconciliation_plan', 'Manual review required; no historical amounts were rewritten.'
  )
FROM expenses e
LEFT JOIN expense_splits es ON es.expense_id = e.id
GROUP BY e.id, e.amount_cents
HAVING COALESCE(SUM(es.original_amount_owed_cents), 0) <> e.amount_cents
ON CONFLICT DO NOTHING;

INSERT INTO money_migration_anomalies (anomaly_type, entity_type, entity_id, details)
SELECT
  'settlement_exceeds_original_split',
  'expense_split',
  es.id,
  jsonb_build_object(
    'original_amount_owed_cents', es.original_amount_owed_cents,
    'settlement_amount_cents_sum', COALESCE(SUM(s.amount_cents), 0),
    'reconciliation_plan', 'Manual review required; no settlement rows were deleted or adjusted.'
  )
FROM expense_splits es
LEFT JOIN settlements s ON s.expense_split_id = es.id
GROUP BY es.id, es.original_amount_owed_cents
HAVING COALESCE(SUM(s.amount_cents), 0) > es.original_amount_owed_cents
ON CONFLICT DO NOTHING;

ALTER TABLE expenses
  ALTER COLUMN amount_cents SET NOT NULL,
  ADD CONSTRAINT expenses_amount_cents_positive CHECK (amount_cents > 0),
  ADD CONSTRAINT expenses_currency_usd CHECK (currency = 'USD');

ALTER TABLE expense_splits
  ALTER COLUMN original_amount_owed_cents SET NOT NULL,
  ALTER COLUMN amount_owed_cents SET NOT NULL,
  ADD CONSTRAINT expense_splits_original_amount_owed_cents_nonnegative
    CHECK (original_amount_owed_cents >= 0),
  ADD CONSTRAINT expense_splits_amount_owed_cents_nonnegative
    CHECK (amount_owed_cents >= 0);

ALTER TABLE settlements
  ALTER COLUMN amount_cents SET NOT NULL,
  ADD CONSTRAINT settlements_amount_cents_positive CHECK (amount_cents > 0);

CREATE INDEX IF NOT EXISTS idx_expense_splits_group_amount_owed_cents
  ON expense_splits (group_id, is_settled, amount_owed_cents);
