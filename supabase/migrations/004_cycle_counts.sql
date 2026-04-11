-- ============================================================
-- 004_cycle_counts.sql — Cycle Counting & Inventory Reconciliation
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- CREATE ENUMS (using DO block for idempotency)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE cycle_count_status AS ENUM ('scheduled', 'in-progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cycle_count_type AS ENUM ('full', 'zone-based');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cycle_count_item_status AS ENUM ('pending', 'counted', 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE discrepancy_root_cause AS ENUM ('damage', 'shrinkage', 'data_entry_error', 'supplier_short', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- CYCLE COUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS cycle_counts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  status          cycle_count_status NOT NULL DEFAULT 'scheduled',
  scheduled_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date  TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  created_by      TEXT,
  notes           TEXT,
  count_type      cycle_count_type NOT NULL DEFAULT 'full',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CYCLE COUNT ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS cycle_count_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_count_id   UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  expected_qty     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_qty       NUMERIC(12, 2),
  variance         NUMERIC(12, 2),
  variance_pct     NUMERIC(10, 4),
  discrepancy_flag BOOLEAN DEFAULT FALSE,
  status           cycle_count_item_status NOT NULL DEFAULT 'pending',
  counted_by       TEXT,
  counted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_count_id, product_id)
);

-- ============================================================
-- INVENTORY DISCREPANCIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_discrepancies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  cycle_count_id  UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  expected_qty    NUMERIC(12, 2) NOT NULL,
  actual_qty      NUMERIC(12, 2) NOT NULL,
  variance        NUMERIC(12, 2) NOT NULL,
  variance_pct    NUMERIC(10, 4) NOT NULL,
  root_cause      discrepancy_root_cause DEFAULT 'shrinkage',
  resolved        BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE cycle_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON cycle_counts             FOR ALL USING (true);
CREATE POLICY "service_all" ON cycle_count_items         FOR ALL USING (true);
CREATE POLICY "service_all" ON inventory_discrepancies   FOR ALL USING (true);

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cycle_counts_warehouse    ON cycle_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cycle_counts_status       ON cycle_counts(status);
CREATE INDEX IF NOT EXISTS idx_cycle_counts_scheduled    ON cycle_counts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_cycle    ON cycle_count_items(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_product  ON cycle_count_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_status  ON cycle_count_items(status);
CREATE INDEX IF NOT EXISTS idx_discrepancies_warehouse   ON inventory_discrepancies(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_resolved    ON inventory_discrepancies(resolved);
CREATE INDEX IF NOT EXISTS idx_discrepancies_cycle       ON inventory_discrepancies(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_root_cause  ON inventory_discrepancies(root_cause);
