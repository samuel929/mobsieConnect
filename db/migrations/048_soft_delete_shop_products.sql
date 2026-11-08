ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shop_products_active_catalogue
  ON shop_products (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;
