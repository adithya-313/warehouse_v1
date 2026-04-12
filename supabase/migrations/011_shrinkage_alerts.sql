-- ============================================================
-- 011_shrinkage_alerts.sql — Real-Time Shrinkage Detection
-- ============================================================

-- Drop existing enums with CASCADE if they exist with wrong values
DROP TYPE IF EXISTS shrinkage_alert_type CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS resolution_status CASCADE;

-- Alert Types
CREATE TYPE shrinkage_alert_type AS ENUM ('ghost_inventory', 'qty_mismatch', 'unauthorized_removal', 'scan_error');

-- Severity Levels
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Resolution Status
CREATE TYPE resolution_status AS ENUM ('open', 'investigating', 'resolved', 'false_alarm');

-- Shrinkage Alerts Table
DROP TABLE IF EXISTS shrinkage_alerts CASCADE;
CREATE TABLE IF NOT EXISTS shrinkage_alerts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  alert_type          shrinkage_alert_type NOT NULL,
  expected_qty        NUMERIC(12, 2),
  actual_qty          NUMERIC(12, 2),
  variance_qty        NUMERIC(12, 2),
  variance_pct        NUMERIC(8, 4),
  bin_location        VARCHAR(50),
  zone                VARCHAR(20),
  aisle               VARCHAR(10),
  flagged_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  flagged_by_name     TEXT,
  severity            alert_severity DEFAULT 'medium',
  resolution_status   resolution_status DEFAULT 'open',
  resolution_notes    TEXT,
  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_name    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  notification_sent   BOOLEAN DEFAULT FALSE,
  escalation_count    INTEGER DEFAULT 0
);

ALTER TABLE shrinkage_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all" ON shrinkage_alerts;
CREATE POLICY "service_all" ON shrinkage_alerts FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_shrinkage_warehouse    ON shrinkage_alerts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shrinkage_product      ON shrinkage_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_shrinkage_severity     ON shrinkage_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_shrinkage_status       ON shrinkage_alerts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_shrinkage_created      ON shrinkage_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shrinkage_bin          ON shrinkage_alerts(bin_location);
CREATE INDEX IF NOT EXISTS idx_shrinkage_type         ON shrinkage_alerts(alert_type);

-- Shrinkage Notification Log
DROP TABLE IF EXISTS shrinkage_notifications CASCADE;
CREATE TABLE IF NOT EXISTS shrinkage_notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id        UUID NOT NULL REFERENCES shrinkage_alerts(id) ON DELETE CASCADE,
  recipient_type  VARCHAR(20) NOT NULL,
  recipient_id    UUID,
  recipient_email TEXT NOT NULL,
  notification_type VARCHAR(20) NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  delivery_status VARCHAR(20) DEFAULT 'sent'
);

ALTER TABLE shrinkage_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all" ON shrinkage_notifications;
CREATE POLICY "service_all" ON shrinkage_notifications FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_notif_alert ON shrinkage_notifications(alert_id);

-- Add inventory_snapshots for expected vs actual comparison
DROP TABLE IF EXISTS inventory_snapshots CASCADE;
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bin_location    VARCHAR(50),
  quantity        NUMERIC(12, 2) NOT NULL,
  snapshot_type   VARCHAR(20) DEFAULT 'daily',
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id, bin_location, snapshot_date)
);

ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all" ON inventory_snapshots;
CREATE POLICY "service_all" ON inventory_snapshots FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_snap_product_date ON inventory_snapshots(product_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snap_warehouse_date ON inventory_snapshots(warehouse_id, snapshot_date DESC);

-- Add cost column to products for shrinkage severity calculation
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 4) DEFAULT 0;
