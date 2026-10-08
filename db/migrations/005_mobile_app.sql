ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES parent_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shop_orders_parent_created
  ON shop_orders (parent_account_id, created_at DESC, id DESC)
  WHERE parent_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mobile_enrollments (
  application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  pickup_password_hash text NOT NULL,
  primary_collector text NOT NULL,
  secondary_collector text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_enrollments_parent
  ON mobile_enrollments (parent_account_id, confirmed_at DESC);

CREATE TABLE IF NOT EXISTS parent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('SUGGESTION', 'INCIDENT', 'RATING', 'GENERAL')),
  message text NOT NULL,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_feedback_tenant_status_created
  ON parent_feedback (tenant_id, status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS parent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('PARENT', 'SCHOOL')),
  sender_name text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_messages_parent_created
  ON parent_messages (parent_account_id, created_at DESC, id DESC);
