-- Previous-school details only apply when the parent confirms that the child
-- attended this school before. A "No" answer must persist as NULL rather than
-- requiring placeholder text.
ALTER TABLE application_preferences
  ALTER COLUMN previous_school DROP NOT NULL,
  ALTER COLUMN previous_school_phone DROP NOT NULL;
