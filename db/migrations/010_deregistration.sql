CREATE TABLE IF NOT EXISTS deregistration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid REFERENCES parent_accounts(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  parent_name text NOT NULL,
  parent_email citext NOT NULL,
  student_name text NOT NULL,
  branch_name text,
  last_day_of_attendance date NOT NULL,
  reason text NOT NULL CHECK (
    reason IN (
      'MOVING_SCHOOLS',
      'RELOCATING',
      'FINANCIAL_REASONS',
      'PERSONAL_REASONS',
      'OTHER'
    )
  ),
  comments text,
  notice_accepted boolean NOT NULL CHECK (notice_accepted),
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status = 'COMPLETED'),
  parent_removed boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deregistration_tenant_submitted
  ON deregistration_requests (tenant_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_deregistration_branch_submitted
  ON deregistration_requests (branch_id, submitted_at DESC, id DESC)
  WHERE branch_id IS NOT NULL;
