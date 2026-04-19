-- ============================================================
-- 014_demand_forecasting.sql — Demand Forecasts and Model Metrics
-- RUN THIS IN: Supabase Dashboard → SQL Editor
-- ============================================================
-- IDEMPOTENT - Safe to run multiple times
-- ============================================================

-- ============================================================
-- STEP 1: demand_forecasts Table
-- ============================================================

CREATE TABLE IF NOT EXISTS demand_forecasts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  forecast_date       DATE NOT NULL,
  predicted_qty       NUMERIC(12, 2) NOT NULL,
  confidence_lower    NUMERIC(12, 2) NOT NULL,
  confidence_upper   NUMERIC(12, 2) NOT NULL,
  confidence_interval NUMERIC(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN confidence_upper > confidence_lower 
      THEN ROUND(((confidence_upper - confidence_lower) / NULLIF(predicted_qty, 0)) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, forecast_date)
);

-- ============================================================
-- STEP 2: model_metrics Table
-- ============================================================

CREATE TABLE IF NOT EXISTS model_metrics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  model_version       VARCHAR(50) DEFAULT 'v1_prophet_indian_holidays',
  mape                NUMERIC(8, 4),
  rmse                NUMERIC(12, 4),
  mae                 NUMERIC(12, 4),
  sample_size         INTEGER NOT NULL,
  forecast_horizon    INTEGER NOT NULL,
  training_start_date DATE NOT NULL,
  training_end_date   DATE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, model_version)
);

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_forecasts_product    ON demand_forecasts(product_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_warehouse  ON demand_forecasts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_date        ON demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_metrics_product       ON model_metrics(product_id);
CREATE INDEX IF NOT EXISTS idx_metrics_mape          ON model_metrics(mape DESC);

-- ============================================================
-- STEP 4: ROW LEVEL SECURITY POLICIES
-- IMPORTANT: Use DROP POLICY IF EXISTS for idempotency
-- ============================================================

ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY;

-- demand_forecasts policies
DROP POLICY IF EXISTS "service_all" ON demand_forecasts;
DROP POLICY IF EXISTS "authenticated_read_all" ON demand_forecasts;

CREATE POLICY "service_all" ON demand_forecasts
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "authenticated_read_all" ON demand_forecasts
  FOR SELECT TO authenticated
  USING (true);

-- model_metrics policies
DROP POLICY IF EXISTS "service_all" ON model_metrics;
DROP POLICY IF EXISTS "authenticated_read_all" ON model_metrics;

CREATE POLICY "service_all" ON model_metrics
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "authenticated_read_all" ON model_metrics
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- COMPLETE!
-- ============================================================