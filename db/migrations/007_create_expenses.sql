DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'food',
      'transport',
      'housing',
      'utilities',
      'entertainment',
      'travel',
      'other'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category expense_category NOT NULL DEFAULT 'other',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_group_date ON expenses (group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses (paid_by);
