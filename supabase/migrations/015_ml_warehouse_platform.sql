-- ============================================================
-- 015_ml_warehouse_platform.sql — ML Platform Schema & Storage
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- UPDATE stock_movements TABLE
-- ============================================================

-- Add new columns to stock_movements
ALTER TABLE stock_movements 
  ADD COLUMN IF NOT EXISTS quantity_change NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS movement_type stock_movement_type,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migrate existing data to new columns
UPDATE stock_movements 
SET 
  quantity_change = quantity,
  movement_type = type
WHERE quantity_change IS NULL OR movement_type IS NULL;

-- Drop old columns (after migration)
ALTER TABLE stock_movements 
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS type;

-- Rename date to created_at for consistency (keep date as alias if needed)
ALTER TABLE stock_movements 
  ALTER COLUMN date SET DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- CREATE ML FEATURE STORE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_feature_store (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  feature_date    DATE NOT NULL,
  
  -- Rolling average features
  rolling_avg_7d  NUMERIC(12, 4),
  rolling_avg_14d NUMERIC(12, 4),
  rolling_avg_30d NUMERIC(12, 4),
  
  -- Velocity features
  category_velocity NUMERIC(12, 4),
  product_velocity   NUMERIC(12, 4),
  
  -- Time-based features
  day_of_week      INTEGER,
  is_holiday       BOOLEAN DEFAULT FALSE,
  is_weekend       BOOLEAN DEFAULT FALSE,
  is_month_end     BOOLEAN DEFAULT FALSE,
  is_month_start   BOOLEAN DEFAULT FALSE,
  
  -- Demand features
  lag_1d           NUMERIC(12, 4),
  lag_7d           NUMERIC(12, 4),
  lag_14d          NUMERIC(12, 4),
  
  -- Additional metadata
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, feature_date)
);

-- ============================================================
-- CREATE VIEW: daily_demand_timeseries
-- ============================================================
CREATE OR REPLACE VIEW daily_demand_timeseries AS
SELECT 
  sm.product_id,
  p.name AS product_name,
  p.category,
  DATE_TRUNC('day', COALESCE(sm.created_at, NOW()))::DATE AS date,
  SUM(
    CASE 
      WHEN sm.movement_type = 'out' THEN -ABS(sm.quantity_change)
      WHEN sm.movement_type = 'in' THEN ABS(sm.quantity_change)
      ELSE sm.quantity_change
    END
  ) AS net_quantity,
  COUNT(*) AS movement_count,
  AVG(sm.quantity_change) AS avg_quantity,
  MAX(sm.quantity_change) AS max_quantity,
  MIN(sm.quantity_change) AS min_quantity
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
GROUP BY sm.product_id, p.name, p.category, DATE_TRUNC('day', COALESCE(sm.created_at, NOW()))::DATE;

-- ============================================================
-- CREATE INDEXES
-- ============================================================

-- GIN index on JSONB metadata for stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_metadata 
ON stock_movements USING GIN (metadata);

-- GIN index on JSONB metadata for ml_feature_store
CREATE INDEX IF NOT EXISTS idx_ml_feature_store_metadata 
ON ml_feature_store USING GIN (metadata);

-- B-Tree composite indexes on (product_id, created_at)
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created 
ON stock_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_feature_store_product_date 
ON ml_feature_store (product_id, feature_date DESC);

-- Additional indexes for ml_feature_store
CREATE INDEX IF NOT EXISTS idx_ml_feature_store_date 
ON ml_feature_store (feature_date DESC);

CREATE INDEX IF NOT EXISTS idx_ml_feature_store_holiday 
ON ml_feature_store (is_holiday) WHERE is_holiday = TRUE;

-- ============================================================
-- ENABLE REALTIME FOR stock_movements
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on ml_feature_store
ALTER TABLE ml_feature_store ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies on stock_movements
DROP POLICY IF EXISTS "service_all" ON stock_movements;

-- Create more granular RLS policies
-- Authenticated users can READ all data
CREATE POLICY "authenticated_read_all" ON stock_movements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_all" ON ml_feature_store
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_all" ON daily_demand_timeseries
  FOR SELECT TO authenticated
  USING (true);

-- Service role can INSERT/UPDATE/DELETE (bypasses RLS automatically)
CREATE POLICY "service_insert" ON stock_movements
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update" ON stock_movements
  FOR UPDATE TO service_role
  USING (true);

CREATE POLICY "service_delete" ON stock_movements
  FOR DELETE TO service_role
  USING (true);

CREATE POLICY "service_all_ml_feature_store" ON ml_feature_store
  FOR ALL TO service_role
  USING (true);

-- Warehouse-worker role specific policies (if role exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'warehouse_worker') THEN
    CREATE ROLE warehouse_worker WITH LOGIN PASSWORD 'warehouse_worker_temp';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow warehouse workers to read and insert stock movements
CREATE POLICY "warehouse_worker_read" ON stock_movements
  FOR SELECT TO warehouse_worker
  USING (true);

CREATE POLICY "warehouse_worker_insert" ON stock_movements
  FOR INSERT TO warehouse_worker
  WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Insert bucket configurations directly into storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('ml-models', 'ml-models', false, 524288000, ARRAY['application/json', 'application/octet-stream'], NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('training-data', 'training-data', false, 1073741824, ARRAY['application/octet-stream', 'application/x-parquet'], NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ML Models bucket policies
-- Service role can manage all files
CREATE POLICY "service_full_access_ml_models" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'ml-models')
  WITH CHECK (bucket_id = 'ml-models');

-- Authenticated users can read ml-models
CREATE POLICY "authenticated_read_ml_models" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ml-models');

-- Warehouse workers can read ml-models
CREATE POLICY "warehouse_worker_read_ml_models" ON storage.objects
  FOR SELECT TO warehouse_worker
  USING (bucket_id = 'ml-models');

-- Training data bucket policies
CREATE POLICY "service_full_access_training_data" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'training-data')
  WITH CHECK (bucket_id = 'training-data');

-- Authenticated users can read training-data
CREATE POLICY "authenticated_read_training_data" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'training-data');

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO warehouse_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO warehouse_worker;
GRANT INSERT ON stock_movements TO warehouse_worker;

GRANT USAGE ON SCHEMA storage TO warehouse_worker;
GRANT SELECT ON storage.buckets TO warehouse_worker;
GRANT SELECT ON storage.objects TO warehouse_worker;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE stock_movements IS 'Track inventory movements with metadata for batch/lot info';
COMMENT ON TABLE ml_feature_store IS 'Pre-computed ML features including rolling averages and holiday flags';
COMMENT ON VIEW daily_demand_timeseries IS 'Aggregated daily demand by SKU for model training';
COMMENT ON TABLE storage.buckets IS 'Storage buckets for ML models and training data';
