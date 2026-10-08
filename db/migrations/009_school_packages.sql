ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS school_type text NOT NULL DEFAULT 'PRIVATE_PRESCHOOL',
  ADD COLUMN IF NOT EXISTS school_stage text NOT NULL DEFAULT 'STAGE_1',
  ADD COLUMN IF NOT EXISTS application_fee_cents integer NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS acceptance_fee_cents integer NOT NULL DEFAULT 130000,
  ADD COLUMN IF NOT EXISTS monthly_fee_cents integer NOT NULL DEFAULT 185000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'application_preferences_school_type_check'
  ) THEN
    ALTER TABLE application_preferences
      ADD CONSTRAINT application_preferences_school_type_check
      CHECK (school_type IN ('PRIVATE_PRESCHOOL', 'CHILD_DAY_CARE', 'NPO_PRESCHOOL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'application_preferences_school_stage_check'
  ) THEN
    ALTER TABLE application_preferences
      ADD CONSTRAINT application_preferences_school_stage_check
      CHECK (school_stage IN ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'GRADE_R'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'application_preferences_fee_values_check'
  ) THEN
    ALTER TABLE application_preferences
      ADD CONSTRAINT application_preferences_fee_values_check
      CHECK (
        application_fee_cents >= 0
        AND acceptance_fee_cents >= 0
        AND monthly_fee_cents >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS application_preferences_school_package_idx
  ON application_preferences (school_type, school_stage, branch_id);
