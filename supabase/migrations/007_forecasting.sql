-- ============================================================
-- 007_forecasting.sql — Demand Forecasting with Prophet
-- ============================================================

DO $$ BEGIN
  CREATE TYPE demand_trend AS ENUM ('rising', 'stable', 'falling');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE liquidation_action AS ENUM (
    'liquidate_discount',
    'transfer_to_hub',
    'return_to_supplier',
    'bundle_promotion'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS demand_forecast (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  forecast_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  days_ahead          INTEGER NOT NULL CHECK (days_ahead IN (30, 60, 90)),
  predicted_qty       NUMERIC(12, 2) NOT NULL,
  confidence_lower    NUMERIC(12, 2) NOT NULL,
  confidence_upper    NUMERIC(12, 2) NOT NULL,
  confidence_score    NUMERIC(5, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  trend               demand_trend NOT NULL DEFAULT 'stable',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, days_ahead)
);

CREATE TABLE IF NOT EXISTS liquidation_recommendations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  current_qty         NUMERIC(12, 2) NOT NULL,
  days_to_expiry     INTEGER,
  recommended_action liquidation_action NOT NULL,
  discount_pct        NUMERIC(5, 2) NOT NULL CHECK (discount_pct >= 10 AND discount_pct <= 50),
  urgency_level       urgency_level NOT NULL DEFAULT 'medium',
  estimated_revenue_loss NUMERIC(12, 2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by     UUID,
  acknowledged_at     TIMESTAMPTZ
);

ALTER TABLE demand_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidation_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON demand_forecast FOR ALL USING (true);
CREATE POLICY "service_all" ON liquidation_recommendations FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_forecast_product    ON demand_forecast(product_id);
CREATE INDEX IF NOT EXISTS idx_forecast_warehouse ON demand_forecast(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_forecast_days       ON demand_forecast(days_ahead);
CREATE INDEX IF NOT EXISTS idx_forecast_created    ON demand_forecast(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidation_product ON liquidation_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_liquidation_urgency ON liquidation_recommendations(urgency_level);
CREATE INDEX IF NOT EXISTS idx_liquidation_ack     ON liquidation_recommendations(acknowledged_by) WHERE acknowledged_by IS NULL;
