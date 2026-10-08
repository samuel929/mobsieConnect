ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS previous_school_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS referral_source text NOT NULL DEFAULT 'SOCIAL_MEDIA';

ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_referral_source_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_referral_source_check
    CHECK (referral_source IN ('SOCIAL_MEDIA', 'WORD_OF_MOUTH', 'RADIO'));
