-- Add Aftercare as a supported enrollment option for existing databases.
-- Dropping and recreating the named check is safe to rerun.
ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_enrollment_type_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_enrollment_type_check
  CHECK (enrollment_type IN ('FULL_TIME', 'PART_TIME', 'AFTERCARE'));
