DO $$ BEGIN
  ALTER TYPE document_kind ADD VALUE 'PROOF_OF_PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE application_consents
  ADD COLUMN IF NOT EXISTS enrolment_terms_accepted boolean NOT NULL DEFAULT false;
