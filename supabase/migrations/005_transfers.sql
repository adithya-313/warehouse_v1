-- ============================================================
-- 005_transfers.sql — Multi-Location Transfer System
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- CREATE ENUMS (using DO block for idempotency)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE transfer_status AS ENUM ('draft', 'approved', 'in-transit', 'received', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_reason AS ENUM ('rebalance', 'dead_stock_redistribution', 'demand_shift', 'supplier_consolidation', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_item_status AS ENUM ('pending', 'shipped', 'received', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_action AS ENUM ('created', 'approved', 'shipped', 'received', 'cancelled', 'item_updated', 'item_received');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- ADD reserved_qty TO INVENTORY TABLE
-- ============================================================
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(12, 2) DEFAULT 0;

-- ============================================================
-- TRANSFERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_warehouse_id   UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status              transfer_status NOT NULL DEFAULT 'draft',
  created_by          TEXT,
  approved_by         TEXT,
  shipped_by          TEXT,
  received_by         TEXT,
  initiated_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_date       TIMESTAMPTZ,
  shipped_date        TIMESTAMPTZ,
  received_date       TIMESTAMPTZ,
  notes               TEXT,
  transfer_reason     transfer_reason NOT NULL DEFAULT 'other',
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

-- ============================================================
-- TRANSFER ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id     UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  requested_qty   NUMERIC(12, 2) NOT NULL,
  shipped_qty     NUMERIC(12, 2),
  received_qty    NUMERIC(12, 2),
  variance        NUMERIC(12, 2),
  variance_pct    NUMERIC(10, 4),
  status          transfer_item_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transfer_id, product_id)
);

-- ============================================================
-- TRANSFER AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id     UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  action          transfer_action NOT NULL,
  performed_by    TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE transfers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON transfers           FOR ALL USING (true);
CREATE POLICY "service_all" ON transfer_items      FOR ALL USING (true);
CREATE POLICY "service_all" ON transfer_audit_log  FOR ALL USING (true);

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transfers_from_warehouse  ON transfers(from_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_to_warehouse    ON transfers(to_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_status          ON transfers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_initiated       ON transfers(initiated_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer    ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_product    ON transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_transfer   ON transfer_audit_log(transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reserved        ON inventory(warehouse_id) WHERE reserved_qty > 0;
