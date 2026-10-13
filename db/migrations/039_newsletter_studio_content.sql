ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SENT';

DO $$ BEGIN
  ALTER TABLE newsletters ADD CONSTRAINT newsletters_status_check
    CHECK (status IN ('DRAFT', 'SENT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
