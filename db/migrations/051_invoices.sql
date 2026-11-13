CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  issued_on date NOT NULL DEFAULT current_date,
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'DUE' CHECK (status IN ('DUE','PAID','CANCELLED')),
  paid_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number),
  CHECK (due_on >= issued_on)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due
  ON invoices (tenant_id, due_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_parent
  ON invoices (parent_account_id, created_at DESC);

DROP TRIGGER IF EXISTS set_invoices_updated_at ON invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
