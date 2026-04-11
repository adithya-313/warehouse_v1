-- ============================================================
-- 006_picking.sql — Picking Optimization System
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- CREATE ENUMS (using DO block for idempotency)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pick_batch_status AS ENUM ('draft', 'assigned', 'in-progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pick_item_status AS ENUM ('pending', 'picked', 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE bin_zone AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- BIN LOCATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bin_locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  aisle          TEXT NOT NULL,
  rack           TEXT NOT NULL,
  bin            TEXT NOT NULL,
  zone           bin_zone NOT NULL DEFAULT 'A',
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  qty_on_hand    NUMERIC(12, 2) DEFAULT 0,
  last_counted   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, aisle, rack, bin)
);

-- ============================================================
-- ADD primary_bin_location_id TO INVENTORY
-- ============================================================
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS primary_bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL;

-- ============================================================
-- PICK BATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pick_batches (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  status                  pick_batch_status NOT NULL DEFAULT 'draft',
  created_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date          TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  picker_id               UUID,
  total_items            INTEGER DEFAULT 0,
  total_picks_completed  INTEGER DEFAULT 0,
  efficiency_score       NUMERIC(8, 2),
  order_ids               UUID[],
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PICK BATCH ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pick_batch_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pick_batch_id   UUID NOT NULL REFERENCES pick_batches(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
  requested_qty   NUMERIC(12, 2) NOT NULL,
  picked_qty     NUMERIC(12, 2) DEFAULT 0,
  status          pick_item_status NOT NULL DEFAULT 'pending',
  sequence_order  INTEGER,
  picked_by       UUID,
  picked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pick_batch_id, product_id)
);

-- ============================================================
-- PICK AUDIT LOG TABLE
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pick_action AS ENUM ('created', 'assigned', 'started', 'item_picked', 'item_verified', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pick_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pick_batch_id   UUID REFERENCES pick_batches(id) ON DELETE CASCADE,
  pick_item_id    UUID REFERENCES pick_batch_items(id) ON DELETE SET NULL,
  action          pick_action NOT NULL,
  performed_by    UUID,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bin_locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_batch_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_audit_log    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON bin_locations     FOR ALL USING (true);
CREATE POLICY "service_all" ON pick_batches      FOR ALL USING (true);
CREATE POLICY "service_all" ON pick_batch_items  FOR ALL USING (true);
CREATE POLICY "service_all" ON pick_audit_log    FOR ALL USING (true);

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bin_locations_warehouse  ON bin_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bin_locations_zone      ON bin_locations(zone);
CREATE INDEX IF NOT EXISTS idx_bin_locations_product   ON bin_locations(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bin_locations_location  ON bin_locations(warehouse_id, zone, aisle, rack, bin);
CREATE INDEX IF NOT EXISTS idx_pick_batches_warehouse  ON pick_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pick_batches_status    ON pick_batches(status);
CREATE INDEX IF NOT EXISTS idx_pick_batches_picker    ON pick_batches(picker_id) WHERE picker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pick_batch_items_batch  ON pick_batch_items(pick_batch_id);
CREATE INDEX IF NOT EXISTS idx_pick_batch_items_status ON pick_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_pick_audit_batch       ON pick_audit_log(pick_batch_id);
