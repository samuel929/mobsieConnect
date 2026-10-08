CREATE TABLE IF NOT EXISTS application_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'PAYFAST' CHECK (provider = 'PAYFAST'),
  merchant_payment_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 500),
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PENDING','COMPLETE','CANCELLED','FAILED')),
  pf_payment_id text,
  payment_payload jsonb NOT NULL DEFAULT '{}',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_payments_application
  ON application_payments (application_id, created_at DESC);
