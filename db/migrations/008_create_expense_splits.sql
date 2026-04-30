CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount_owed NUMERIC(12, 2) NOT NULL CHECK (amount_owed >= 0),
  ratio NUMERIC(5, 4) NOT NULL CHECK (ratio >= 0),
  is_settled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expense_id, user_id),
  FOREIGN KEY (group_id, user_id) REFERENCES group_members (group_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_group_id ON expense_splits (group_id);
