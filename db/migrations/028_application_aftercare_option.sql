ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS aftercare_requested boolean NOT NULL DEFAULT false;

UPDATE application_preferences
SET aftercare_requested = true,
    enrollment_type = 'FULL_TIME'
WHERE enrollment_type = 'AFTERCARE';

ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_enrollment_type_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_enrollment_type_check
  CHECK (enrollment_type IN ('FULL_TIME', 'PART_TIME'));
