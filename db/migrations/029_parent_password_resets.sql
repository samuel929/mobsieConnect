CREATE TABLE IF NOT EXISTS parent_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_password_resets_parent_created_idx
  ON parent_password_resets(parent_account_id, created_at DESC);
