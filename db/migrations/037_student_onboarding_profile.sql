ALTER TABLE students
  ADD COLUMN IF NOT EXISTS onboarding_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_students_onboarding_profile
  ON students USING gin (onboarding_profile);
