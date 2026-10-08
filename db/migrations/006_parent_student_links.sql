ALTER TABLE parent_accounts
  ADD COLUMN IF NOT EXISTS preferred_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES parent_accounts(id) ON DELETE SET NULL;

UPDATE students s
SET parent_account_id = a.parent_account_id
FROM applications a
WHERE s.application_id = a.id
  AND s.parent_account_id IS NULL
  AND a.parent_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_parent_created
  ON students (parent_account_id, created_at DESC, id DESC)
  WHERE parent_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parent_accounts_branch_created
  ON parent_accounts (preferred_branch_id, created_at DESC, id DESC)
  WHERE preferred_branch_id IS NOT NULL;
