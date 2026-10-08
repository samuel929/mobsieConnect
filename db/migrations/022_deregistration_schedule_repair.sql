-- Upgrade databases created by earlier deregistration implementations.
-- CREATE TABLE IF NOT EXISTS in migration 016 does not add columns to an
-- already-existing table, so repair it in place without discarding requests.
ALTER TABLE deregistration_requests
  ADD COLUMN IF NOT EXISTS removal_scheduled_for date;

-- Existing requests should remain active until the end of the calendar year
-- in which their final attendance date falls.
UPDATE deregistration_requests
SET removal_scheduled_for = make_date(
  EXTRACT(YEAR FROM COALESCE(last_day_of_attendance, CURRENT_DATE))::integer,
  12,
  31
)
WHERE removal_scheduled_for IS NULL;

ALTER TABLE deregistration_requests
  ALTER COLUMN removal_scheduled_for SET NOT NULL;

CREATE INDEX IF NOT EXISTS deregistration_requests_due_idx
  ON deregistration_requests (removal_scheduled_for)
  WHERE status = 'SCHEDULED';
