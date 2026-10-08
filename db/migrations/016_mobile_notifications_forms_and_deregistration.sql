-- Parent-facing records used by the Expo app. These tables are deliberately
-- append-friendly so notification history and signed consent records remain auditable.

CREATE TABLE IF NOT EXISTS consent_form_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  template_id text NOT NULL,
  title text NOT NULL,
  child_name text NOT NULL,
  guardian_name text NOT NULL,
  guardian_id text NOT NULL,
  signature text NOT NULL,
  document_html text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_account_id, student_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_completions_parent_signed
  ON consent_form_completions (parent_account_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS mobile_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_notifications_tenant_created
  ON mobile_notifications (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{"enabled":true}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_account_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_active
  ON push_tokens (tenant_id, parent_account_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS mobile_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES mobile_notifications(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  push_token_id uuid REFERENCES push_tokens(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, parent_account_id, push_token_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_notification_deliveries_parent_unread
  ON mobile_notification_deliveries (parent_account_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS deregistration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  last_day_of_attendance date NOT NULL,
  removal_scheduled_for date NOT NULL,
  reason text NOT NULL,
  comments text,
  notice_accepted boolean NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CANCELLED', 'PROCESSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CHECK (removal_scheduled_for >= last_day_of_attendance)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deregistration_active_student
  ON deregistration_requests (student_id)
  WHERE status = 'SCHEDULED';

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_email citext NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  provider_error text
);

-- A timetable is scoped to a campus, class and day. The API orders this by
-- start_time, so a parent always sees a stable timeline.
CREATE TABLE IF NOT EXISTS daily_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  activity_date date NOT NULL,
  activity_type text NOT NULL DEFAULT 'CUSTOM',
  title text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'calendar-outline',
  color text NOT NULL DEFAULT '#DFF5E6',
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- Earlier dashboard builds created daily_activities before it was scoped to a
-- calendar day. Upgrade that table in place instead of failing the migration
-- when it already exists.
ALTER TABLE daily_activities
  ADD COLUMN IF NOT EXISTS activity_date date;

UPDATE daily_activities
SET activity_date = CURRENT_DATE
WHERE activity_date IS NULL;

ALTER TABLE daily_activities
  ALTER COLUMN activity_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_activities_schedule
  ON daily_activities (tenant_id, branch_id, class_name, activity_date, start_time);
