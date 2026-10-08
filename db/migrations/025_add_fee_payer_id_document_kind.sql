-- Allows the required fee-payer identity document to be stored with an application.
-- PostgreSQL enums are database-level types, so this must be migrated separately.
DO $$
BEGIN
  ALTER TYPE document_kind ADD VALUE 'FEE_PAYER_ID';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
