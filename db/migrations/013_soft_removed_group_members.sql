ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_group_members_group_active
  ON group_members (group_id, user_id)
  WHERE removed_at IS NULL;
