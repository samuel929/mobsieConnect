CREATE TABLE IF NOT EXISTS control_centre_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(state) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_control_centre_state_updated
  ON control_centre_state (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_control_centre_state_gin
  ON control_centre_state USING gin (state jsonb_path_ops);
