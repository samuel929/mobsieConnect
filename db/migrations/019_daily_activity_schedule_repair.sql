-- Repair databases created before daily_activities gained an activity_date.
-- Keeping this migration idempotent makes existing Neon projects safe to upgrade.
DO $$
BEGIN
  IF to_regclass('public.daily_activities') IS NOT NULL THEN
    ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS activity_date date;
    UPDATE daily_activities SET activity_date = CURRENT_DATE WHERE activity_date IS NULL;
    ALTER TABLE daily_activities ALTER COLUMN activity_date SET NOT NULL;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_activities_schedule ON daily_activities (tenant_id, branch_id, class_name, activity_date, start_time)';
  END IF;
END $$;
