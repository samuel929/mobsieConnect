-- Extend the document enum without removing historic document values.
-- Medical-aid evidence is optional; the API submit endpoint enforces the rest.
DO $$ BEGIN
  ALTER TYPE document_kind ADD VALUE 'LEARNER_PHOTO';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE document_kind ADD VALUE 'MEDICAL_AID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE document_kind ADD VALUE 'CLINIC_CARD';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE document_kind ADD VALUE 'PROOF_OF_INCOME';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
