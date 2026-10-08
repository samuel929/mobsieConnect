-- Ensure every existing Neon database has the columns used by the dashboard
-- CRUD routes and the Expo parent feed. This can safely run after older builds.
DO $$
BEGIN
  IF to_regclass('public.daily_activities') IS NULL THEN
    CREATE TABLE daily_activities (
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
      CONSTRAINT daily_activities_time_range CHECK (end_time > start_time)
    );
  END IF;
END $$;

ALTER TABLE daily_activities
  ADD COLUMN IF NOT EXISTS activity_date date,
  ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'calendar-outline',
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#DFF5E6',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE daily_activities
SET activity_date = CURRENT_DATE
WHERE activity_date IS NULL;

ALTER TABLE daily_activities
  ALTER COLUMN activity_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_activities_tenant_branch_date_time
  ON daily_activities (tenant_id, branch_id, activity_date, class_name, start_time);
