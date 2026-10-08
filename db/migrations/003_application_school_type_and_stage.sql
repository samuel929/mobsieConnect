ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS school_type text NOT NULL DEFAULT 'PRIVATE_PRESCHOOL',
  ADD COLUMN IF NOT EXISTS school_stage text NOT NULL DEFAULT 'STAGE_1';

ALTER TABLE application_preferences
  DROP CONSTRAINT IF EXISTS application_preferences_school_type_check,
  DROP CONSTRAINT IF EXISTS application_preferences_school_stage_check;

ALTER TABLE application_preferences
  ADD CONSTRAINT application_preferences_school_type_check
    CHECK (school_type IN ('PRIVATE_PRESCHOOL', 'CHILD_DAY_CARE', 'NPO_PRESCHOOL')),
  ADD CONSTRAINT application_preferences_school_stage_check
    CHECK (school_stage IN ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'GRADE_R'));
