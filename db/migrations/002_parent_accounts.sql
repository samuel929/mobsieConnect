CREATE TABLE IF NOT EXISTS parent_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email citext NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS parent_account_id uuid
    REFERENCES parent_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parent_accounts_tenant_email
  ON parent_accounts (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_applications_parent_account_created
  ON applications (parent_account_id, created_at DESC)
  WHERE parent_account_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_parent_accounts_updated_at ON parent_accounts;
CREATE TRIGGER set_parent_accounts_updated_at
  BEFORE UPDATE ON parent_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
