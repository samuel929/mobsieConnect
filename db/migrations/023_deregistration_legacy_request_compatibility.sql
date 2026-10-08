-- Keep databases created by the original deregistration migration compatible
-- with the current mobile endpoint.  Earlier installations required these
-- snapshot fields, while the newer API stores them when a request is created.
-- The migration is additive and preserves all existing requests.
ALTER TABLE deregistration_requests
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_email citext NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS branch_name text,
  ADD COLUMN IF NOT EXISTS scheduled_for date;

-- The scheduled date is deliberately the last day of the calendar year, not
-- the requested final attendance date.  This is what the year-end cleanup job
-- uses before it removes a learner and parent account.
UPDATE deregistration_requests
SET scheduled_for = COALESCE(
  scheduled_for,
  removal_scheduled_for,
  make_date(EXTRACT(YEAR FROM COALESCE(last_day_of_attendance, CURRENT_DATE))::integer, 12, 31)
)
WHERE scheduled_for IS NULL;

ALTER TABLE deregistration_requests
  ALTER COLUMN scheduled_for SET NOT NULL;

CREATE INDEX IF NOT EXISTS deregistration_requests_scheduled_for_idx
  ON deregistration_requests (scheduled_for)
  WHERE status = 'SCHEDULED';
