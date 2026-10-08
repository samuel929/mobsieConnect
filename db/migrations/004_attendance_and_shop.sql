CREATE TABLE IF NOT EXISTS attendance_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
  captured_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN', 'OUT_OF_STOCK')),
  image_url text,
  image_public_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference text NOT NULL,
  parent_name text NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  status text NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'READY_FOR_COLLECTION', 'COLLECTED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);

CREATE TABLE IF NOT EXISTS shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES shop_products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_branch_date
  ON attendance_registers (tenant_id, branch_id, attendance_date DESC, student_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_tenant_status_name
  ON shop_products (tenant_id, status, name);
CREATE INDEX IF NOT EXISTS idx_shop_orders_tenant_status_created
  ON shop_orders (tenant_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order
  ON shop_order_items (order_id, product_id);
