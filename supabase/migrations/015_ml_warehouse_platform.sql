-- ============================================================
-- 015_ml_warehouse_platform.sql — ML Platform Schema & Storage
-- RUN THIS IN: Supabase Dashboard → SQL Editor
-- ============================================================
-- This file is IDEMPOTENT - safe to run multiple times
-- ============================================================

-- ============================================================
-- STEP 1: UPDATE stock_movements TABLE (Add new columns if missing)
-- ============================================================

ALTER TABLE stock_movements 
  ADD COLUMN IF NOT EXISTS quantity_change NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS movement_type stock_movement_type,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migrate existing data to new columns (only where NULL)
UPDATE stock_movements 
SET 
  quantity_change = COALESCE(quantity, quantity_change),
  movement_type = COALESCE(type, movement_type)
WHERE (quantity_change IS NULL OR movement_type IS NULL)
  AND (quantity IS NOT NULL OR type IS NOT NULL);

ALTER TABLE stock_movements 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- STEP 2: CREATE ML FEATURE STORE TABLE
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
-- STEP 3: CREATE VIEW: daily_demand_timeseries
-- IMPORTANT: Views cannot have RLS or Indexes - these are inherited from source tables
-- ============================================================

CREATE OR REPLACE VIEW daily_demand_timeseries AS
SELECT 
  sm.product_id,
  p.name AS product_name,
  p.category,
  DATE_TRUNC('day', COALESCE(sm.created_at, NOW()))::DATE AS date,
  SUM(
    CASE 
      WHEN sm.movement_type = 'out' THEN -ABS(COALESCE(sm.quantity_change, 0))
      WHEN sm.movement_type = 'in' THEN ABS(COALESCE(sm.quantity_change, 0))
      ELSE COALESCE(sm.quantity_change, 0)
    END
  ) AS net_quantity,
  COUNT(*) AS movement_count,
  AVG(COALESCE(sm.quantity_change, 0)) AS avg_quantity,
  MAX(COALESCE(sm.quantity_change, 0)) AS max_quantity,
  MIN(COALESCE(sm.quantity_change, 0)) AS min_quantity
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
GROUP BY sm.product_id, p.name, p.category, DATE_TRUNC('day', COALESCE(sm.created_at, NOW()))::DATE;

-- ============================================================
-- STEP 4: CREATE INDEXES (Tables only, NOT views)
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
-- STEP 5: ENABLE REALTIME FOR stock_movements
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;

-- ============================================================
-- STEP 6: ROW LEVEL SECURITY POLICIES
-- IMPORTANT: Views don't need RLS - drop any accidentally attached policies
-- ============================================================

-- Drop any RLS mistakenly applied to views (views inherit RLS from source tables)
DROP POLICY IF EXISTS "authenticated_read_all" ON daily_demand_timeseries;
DROP POLICY IF EXISTS "service_all" ON daily_demand_timeseries;

-- Enable RLS on ml_feature_store
ALTER TABLE ml_feature_store ENABLE ROW LEVEL SECURITY;

-- STOCK_MOVEMENTS Policies - Drop first, then create
DROP POLICY IF EXISTS "service_all" ON stock_movements;
DROP POLICY IF EXISTS "authenticated_read_all" ON stock_movements;
DROP POLICY IF EXISTS "warehouse_worker_read" ON stock_movements;
DROP POLICY IF EXISTS "warehouse_worker_insert" ON stock_movements;

CREATE POLICY "service_all" ON stock_movements
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "authenticated_read_all" ON stock_movements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "warehouse_worker_read" ON stock_movements
  FOR SELECT TO warehouse_worker
  USING (true);

CREATE POLICY "warehouse_worker_insert" ON stock_movements
  FOR INSERT TO warehouse_worker
  WITH CHECK (true);

-- ML_FEATURE_STORE Policies - Drop first, then create
DROP POLICY IF EXISTS "service_all_ml_feature_store" ON ml_feature_store;
DROP POLICY IF EXISTS "authenticated_read_ml_feature_store" ON ml_feature_store;

CREATE POLICY "service_all_ml_feature_store" ON ml_feature_store
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "authenticated_read_ml_feature_store" ON ml_feature_store
  FOR SELECT TO authenticated
  USING (true);

-- Create warehouse_worker role if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'warehouse_worker') THEN
    CREATE ROLE warehouse_worker WITH LOGIN PASSWORD 'warehouse_worker_temp';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- STEP 7: STORAGE BUCKETS (INSERT with ON CONFLICT - idempotent)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('ml-models', 'ml-models', false, 524288000, ARRAY['application/json', 'application/octet-stream'], NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('training-data', 'training-data', false, 1073741824, ARRAY['application/octet-stream', 'application/x-parquet'], NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 8: STORAGE RLS POLICIES
-- ============================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ML Models bucket policies
DROP POLICY IF EXISTS "service_full_access_ml_models" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_ml_models" ON storage.objects;
DROP POLICY IF EXISTS "warehouse_worker_read_ml_models" ON storage.objects;

CREATE POLICY "service_full_access_ml_models" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'ml-models')
  WITH CHECK (bucket_id = 'ml-models');

CREATE POLICY "authenticated_read_ml_models" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ml-models');

CREATE POLICY "warehouse_worker_read_ml_models" ON storage.objects
  FOR SELECT TO warehouse_worker
  USING (bucket_id = 'ml-models');

-- Training data bucket policies
DROP POLICY IF EXISTS "service_full_access_training_data" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_training_data" ON storage.objects;

CREATE POLICY "service_full_access_training_data" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'training-data')
  WITH CHECK (bucket_id = 'training-data');

CREATE POLICY "authenticated_read_training_data" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'training-data');

-- ============================================================
-- STEP 9: GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO warehouse_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO warehouse_worker;
GRANT INSERT ON stock_movements TO warehouse_worker;

GRANT USAGE ON SCHEMA storage TO warehouse_worker;
GRANT SELECT ON storage.buckets TO warehouse_worker;
GRANT SELECT ON storage.objects TO warehouse_worker;

-- ============================================================
-- STEP 10: COMMENTS
-- ============================================================

COMMENT ON TABLE stock_movements IS 'Track inventory movements with metadata for batch/lot info';
COMMENT ON TABLE ml_feature_store IS 'Pre-computed ML features including rolling averages and holiday flags';
COMMENT ON VIEW daily_demand_timeseries IS 'Aggregated daily demand by SKU for model training';
COMMENT ON TABLE storage.buckets IS 'Storage buckets for ML models and training data';

-- ============================================================
-- COMPLETE!
-- ============================================================