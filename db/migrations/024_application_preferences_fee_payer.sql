-- Repair migration for the enrolment fee-payer fields.
-- Safe to run on databases that already have some or all of these columns.
ALTER TABLE application_preferences
  ADD COLUMN IF NOT EXISTS fee_payer_first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_payer_last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_payer_id_document_url text,
  ADD COLUMN IF NOT EXISTS fee_payer_terms_accepted boolean NOT NULL DEFAULT false;

UPDATE application_preferences
SET
  fee_payer_first_name = COALESCE(fee_payer_first_name, ''),
  fee_payer_last_name = COALESCE(fee_payer_last_name, ''),
  fee_payer_terms_accepted = COALESCE(fee_payer_terms_accepted, false);
