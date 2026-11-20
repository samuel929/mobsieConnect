CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  merchant_payment_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 1),
  status text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED','PENDING','COMPLETE','CANCELLED','FAILED')),
  return_url text,
  pf_payment_id text,
  payment_payload jsonb NOT NULL DEFAULT '{}',
  payment_method text,
  amount_gross_cents integer,
  amount_fee_cents integer,
  amount_net_cents integer,
  payer_first_name text,
  payer_last_name text,
  payer_email text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON invoice_payments (invoice_id, created_at DESC);
