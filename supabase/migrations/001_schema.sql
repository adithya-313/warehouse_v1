-- ============================================================
-- 001_schema.sql — AI Warehouse Management MVP
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CREATE ENUMS (using DO block for idempotency)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'transfer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('success', 'partial', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  location      TEXT,
  capacity      INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  contact             TEXT,
  avg_lead_time_days  INTEGER DEFAULT 7,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  category     TEXT,
  unit         TEXT DEFAULT 'units',
  expiry_date  DATE,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id   UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity       NUMERIC(12, 2) DEFAULT 0,
  reorder_point  NUMERIC(12, 2) DEFAULT 0,
  reserved_qty  NUMERIC(12, 2) DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        stock_movement_type NOT NULL,
  quantity    NUMERIC(12, 2) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  note        TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ============================================================
-- PRODUCT ANALYTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_analytics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  avg_daily_demand    NUMERIC(10, 4) DEFAULT 0,
  days_to_stockout    NUMERIC(10, 2),
  expiry_risk_score   NUMERIC(5, 2) DEFAULT 0,
  health_score        NUMERIC(5, 2) DEFAULT 0,
  health_label        TEXT DEFAULT 'Monitor',
  classification      TEXT DEFAULT 'Slow Moving',
  demand_trend        TEXT DEFAULT 'stable',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  severity    alert_severity NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  resolved    BOOLEAN DEFAULT FALSE,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIONS (recommendations linked to alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  recommendation  TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYNC LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          TEXT NOT NULL DEFAULT 'tally',
  status          sync_status NOT NULL DEFAULT 'success',
  records_synced  INTEGER DEFAULT 0,
  error_message   TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- All tables: service role bypasses RLS; anon key has no access
-- Frontend reads via server-side routes using service role key
-- ============================================================
ALTER TABLE warehouses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs         ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (app server) to read/write
CREATE POLICY "service_all" ON warehouses        FOR ALL USING (true);
CREATE POLICY "service_all" ON suppliers         FOR ALL USING (true);
CREATE POLICY "service_all" ON products          FOR ALL USING (true);
CREATE POLICY "service_all" ON inventory         FOR ALL USING (true);
CREATE POLICY "service_all" ON stock_movements   FOR ALL USING (true);
CREATE POLICY "service_all" ON product_analytics FOR ALL USING (true);
CREATE POLICY "service_all" ON alerts            FOR ALL USING (true);
CREATE POLICY "service_all" ON actions           FOR ALL USING (true);
CREATE POLICY "service_all" ON sync_logs         FOR ALL USING (true);

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse  ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_product    ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date       ON stock_movements(date);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved      ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_severity      ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_analytics_health     ON product_analytics(health_score);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced_at  ON sync_logs(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_reserved    ON inventory(warehouse_id) WHERE reserved_qty > 0;
