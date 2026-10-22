ALTER TABLE application_payments
  ADD COLUMN IF NOT EXISTS return_url text;
