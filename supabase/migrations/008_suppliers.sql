-- ============================================================
-- 008_suppliers.sql — Supplier Performance Metrics
-- ============================================================

DO $$ BEGIN
  CREATE TYPE supplier_category AS ENUM ('primary', 'secondary', 'emergency');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE supplier_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 30;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS category supplier_category DEFAULT 'secondary';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status supplier_status DEFAULT 'active';

CREATE TABLE IF NOT EXISTS supplier_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery   DATE NOT NULL,
  actual_delivery     DATE,
  ordered_qty         NUMERIC(12, 2) NOT NULL,
  received_qty        NUMERIC(12, 2),
  unit_cost           NUMERIC(12, 4) NOT NULL,
  total_cost         NUMERIC(12, 2),
  on_time             BOOLEAN,
  quality_issues      BOOLEAN DEFAULT FALSE,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  logged_by           TEXT,
  received_by        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_performance (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id             UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE UNIQUE,
  on_time_delivery_pct    NUMERIC(5, 2) DEFAULT 0,
  quality_score           NUMERIC(5, 2) DEFAULT 100,
  avg_lead_time_days      NUMERIC(8, 2) DEFAULT 0,
  last_30_days_orders     INTEGER DEFAULT 0,
  total_cost_30_days      NUMERIC(12, 2) DEFAULT 0,
  reliability_score       NUMERIC(5, 2) DEFAULT 0,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON supplier_orders FOR ALL USING (true);
CREATE POLICY "service_all" ON supplier_performance FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier    ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_product     ON supplier_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_date  ON supplier_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status      ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_perf_supplier      ON supplier_performance(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_perf_reliability   ON supplier_performance(reliability_score);
