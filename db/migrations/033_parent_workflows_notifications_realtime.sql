ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS child_has_disability boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disability_details text,
  ADD COLUMN IF NOT EXISTS application_type text NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS registration_fee_waived boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE applications ADD CONSTRAINT applications_application_type_check
    CHECK (application_type IN ('NEW', 'REREGISTRATION'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE mobile_notifications
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE INDEX IF NOT EXISTS idx_mobile_notifications_schedule
  ON mobile_notifications (status, scheduled_at) WHERE status = 'SCHEDULED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_notifications_source
  ON mobile_notifications (tenant_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'All campuses',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_tenant_published
  ON newsletters (tenant_id, published_at DESC);

CREATE TABLE IF NOT EXISTS branch_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_branch_id uuid NOT NULL REFERENCES branches(id),
  to_branch_id uuid NOT NULL REFERENCES branches(id),
  old_reference text,
  new_reference text,
  reason text,
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'DECLINED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_branch_transfer_parent
  ON branch_transfer_requests (parent_account_id, created_at DESC);
