CREATE TABLE IF NOT EXISTS dashboard_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  folder text NOT NULL,
  shared_with text NOT NULL DEFAULT 'All campuses',
  file_url text NOT NULL,
  public_id text NOT NULL,
  mime_type text NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_documents_tenant_created
  ON dashboard_documents (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_documents_tenant_folder
  ON dashboard_documents (tenant_id, folder);
