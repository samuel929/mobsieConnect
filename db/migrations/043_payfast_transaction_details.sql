ALTER TABLE application_payments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS amount_gross_cents integer,
  ADD COLUMN IF NOT EXISTS amount_fee_cents integer,
  ADD COLUMN IF NOT EXISTS amount_net_cents integer,
  ADD COLUMN IF NOT EXISTS payer_first_name text,
  ADD COLUMN IF NOT EXISTS payer_last_name text,
  ADD COLUMN IF NOT EXISTS payer_email text;

UPDATE application_payments
SET
  payment_method = COALESCE(payment_method, NULLIF(payment_payload->>'payment_method', '')),
  amount_gross_cents = COALESCE(
    amount_gross_cents,
    CASE WHEN COALESCE(payment_payload->>'amount_gross', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN round((payment_payload->>'amount_gross')::numeric * 100)::integer END
  ),
  amount_fee_cents = COALESCE(
    amount_fee_cents,
    CASE WHEN COALESCE(payment_payload->>'amount_fee', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN round((payment_payload->>'amount_fee')::numeric * 100)::integer END
  ),
  amount_net_cents = COALESCE(
    amount_net_cents,
    CASE WHEN COALESCE(payment_payload->>'amount_net', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN round((payment_payload->>'amount_net')::numeric * 100)::integer END
  ),
  payer_first_name = COALESCE(payer_first_name, NULLIF(payment_payload->>'name_first', '')),
  payer_last_name = COALESCE(payer_last_name, NULLIF(payment_payload->>'name_last', '')),
  payer_email = COALESCE(payer_email, NULLIF(payment_payload->>'email_address', ''))
WHERE payment_payload <> '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_application_payments_paid_at
  ON application_payments (paid_at DESC)
  WHERE status = 'COMPLETE';
