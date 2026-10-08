ALTER TABLE deregistration_requests
  ADD COLUMN IF NOT EXISTS scheduled_for date;

ALTER TABLE deregistration_requests
  ALTER COLUMN completed_at DROP NOT NULL;

ALTER TABLE deregistration_requests
  DROP CONSTRAINT IF EXISTS deregistration_requests_status_check;

ALTER TABLE deregistration_requests
  ADD CONSTRAINT deregistration_requests_status_check
  CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED'));

ALTER TABLE deregistration_requests
  ALTER COLUMN status SET DEFAULT 'SCHEDULED';

UPDATE deregistration_requests
SET scheduled_for = COALESCE(scheduled_for, last_day_of_attendance)
WHERE scheduled_for IS NULL;

ALTER TABLE deregistration_requests
  ALTER COLUMN scheduled_for SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deregistration_scheduled
  ON deregistration_requests (status, scheduled_for)
  WHERE status = 'SCHEDULED';
