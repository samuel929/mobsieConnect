CREATE TABLE IF NOT EXISTS mobile_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'All campuses',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_notifications_feed_idx
  ON mobile_notifications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mobile_notifications_branch_idx
  ON mobile_notifications (tenant_id, branch_id, created_at DESC);
