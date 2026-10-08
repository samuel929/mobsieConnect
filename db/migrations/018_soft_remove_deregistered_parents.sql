-- Keep financial/admissions history referentially intact while making accounts
-- unavailable after their scheduled year-end deregistration date.
ALTER TABLE parent_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS parent_accounts_active_idx
  ON parent_accounts (tenant_id, email)
  WHERE deleted_at IS NULL AND is_active = true;
