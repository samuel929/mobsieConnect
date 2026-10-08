CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_error text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_recipient
  ON mobile_push_tokens (tenant_id, parent_account_id, is_active)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS set_mobile_push_tokens_updated_at ON mobile_push_tokens;
CREATE TRIGGER set_mobile_push_tokens_updated_at
  BEFORE UPDATE ON mobile_push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
