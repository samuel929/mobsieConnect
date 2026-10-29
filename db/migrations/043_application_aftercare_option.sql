ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS aftercare_option text;

ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_aftercare_option_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_aftercare_option_check
  CHECK (aftercare_option IS NULL OR aftercare_option IN ('AD_HOC', 'FULL_TIME', 'PRIMARY_SCHOOL'));
