ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS additional_guardian_name text,
  ADD COLUMN IF NOT EXISTS additional_guardian_relationship text,
  ADD COLUMN IF NOT EXISTS additional_guardian_email citext,
  ADD COLUMN IF NOT EXISTS additional_guardian_phone text;
