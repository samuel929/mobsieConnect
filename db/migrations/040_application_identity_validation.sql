ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS child_id_number varchar(13);

ALTER TABLE application_consents
  ADD COLUMN IF NOT EXISTS photo_consent boolean NOT NULL DEFAULT false;

ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_referral_source_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_referral_source_check
  CHECK (referral_source IN (
    'SOCIAL_MEDIA', 'WORD_OF_MOUTH', 'RADIO', 'STREET_BOARDS',
    'WEBSITE', 'VEHICLE_BRANDING', 'OTHER'
  ));
