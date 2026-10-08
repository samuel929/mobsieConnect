ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS previous_school_phone text,
  ADD COLUMN IF NOT EXISTS referral_source text;

UPDATE application_preferences
SET previous_school = COALESCE(NULLIF(trim(previous_school), ''), 'Not provided'),
    previous_school_phone = COALESCE(NULLIF(trim(previous_school_phone), ''), 'Not provided'),
    referral_source = COALESCE(NULLIF(trim(referral_source), ''), 'WORD_OF_MOUTH');

ALTER TABLE application_preferences
  ALTER COLUMN previous_school SET NOT NULL,
  ALTER COLUMN previous_school_phone SET NOT NULL,
  ALTER COLUMN referral_source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'application_preferences_referral_source_check'
  ) THEN
    ALTER TABLE application_preferences
      ADD CONSTRAINT application_preferences_referral_source_check
      CHECK (referral_source IN ('SOCIAL_MEDIA', 'WORD_OF_MOUTH', 'RADIO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS application_preferences_branch_application_idx
  ON application_preferences (branch_id, application_id);
