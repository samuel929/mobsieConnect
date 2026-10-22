ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS school_grade text;

UPDATE branches
SET school_grade = CASE
  WHEN name ILIKE '%soshanguve%' THEN 'Grade A'
  ELSE 'Grade B'
END
WHERE school_grade IS NULL;

ALTER TABLE branches
  ALTER COLUMN school_grade SET DEFAULT 'Grade B',
  ALTER COLUMN school_grade SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_school_grade_check'
  ) THEN
    ALTER TABLE branches
      ADD CONSTRAINT branches_school_grade_check
      CHECK (school_grade IN ('Grade A', 'Grade B'));
  END IF;
END $$;
