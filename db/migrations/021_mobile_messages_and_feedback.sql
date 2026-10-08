-- Durable parent communication records. These replace mobile-only message
-- actions so the dashboard and Expo app read the same Neon records.
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
  ON parent_messages (parent_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_messages_tenant_created
  ON parent_messages (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS parent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('SUGGESTION', 'INCIDENT', 'RATING', 'GENERAL')),
  message text NOT NULL,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_feedback_tenant_created
  ON parent_feedback (tenant_id, created_at DESC);
