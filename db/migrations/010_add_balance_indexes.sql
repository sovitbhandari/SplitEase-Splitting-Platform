CREATE INDEX IF NOT EXISTS idx_expense_splits_user_settled
  ON expense_splits (user_id, is_settled);

CREATE INDEX IF NOT EXISTS idx_expense_splits_group_settled
  ON expense_splits (group_id, is_settled);
