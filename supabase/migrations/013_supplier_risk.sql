-- ============================================================
-- 013_supplier_risk.sql — Supplier Risk Prediction Schema
-- ============================================================

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_alert_type AS ENUM ('critical_risk', 'high_risk', 'risk_increase', 'payment_issue', 'delivery_degradation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. supplier_metrics (stores live supplier health data)
CREATE TABLE IF NOT EXISTS supplier_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL CHECK (metric_date <= CURRENT_DATE),
  on_time_delivery_pct NUMERIC(5,2) CHECK (on_time_delivery_pct >= 0 AND on_time_delivery_pct <= 100),
  quality_score NUMERIC(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  avg_lead_time_days NUMERIC(10,2),
  lead_time_variance NUMERIC(10,2),
  order_value_trend NUMERIC(10,2),
  payment_days_late_avg NUMERIC(10,2),
  order_cancellation_pct NUMERIC(5,2) CHECK (order_cancellation_pct >= 0 AND order_cancellation_pct <= 100),
  UNIQUE(supplier_id, metric_date)
);

-- 2. supplier_risk_scores (final AI predictions)
CREATE TABLE IF NOT EXISTS supplier_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  risk_assessment_date DATE NOT NULL CHECK (risk_assessment_date <= CURRENT_DATE),
  financial_risk_score NUMERIC(5,2) CHECK (financial_risk_score >= 0 AND financial_risk_score <= 100),
  operational_risk_score NUMERIC(5,2) CHECK (operational_risk_score >= 0 AND operational_risk_score <= 100),
  market_risk_score NUMERIC(5,2) CHECK (market_risk_score >= 0 AND market_risk_score <= 100),
  overall_risk_score NUMERIC(5,2) CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  failure_probability_6m NUMERIC(5,2) CHECK (failure_probability_6m >= 0 AND failure_probability_6m <= 100),
  risk_level risk_level NOT NULL,
  key_risk_factors JSONB DEFAULT '[]'::jsonb,
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, risk_assessment_date)
);

-- 3. supplier_risk_alerts (triggered when risk threshold crossed)
CREATE TABLE IF NOT EXISTS supplier_risk_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  risk_score_id UUID REFERENCES supplier_risk_scores(id) ON DELETE CASCADE,
  alert_type risk_alert_type NOT NULL,
  severity risk_alert_severity NOT NULL,
  message TEXT NOT NULL,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing
CREATE INDEX idx_supplier_metrics_supplier ON supplier_metrics(supplier_id);
CREATE INDEX idx_supplier_metrics_date ON supplier_metrics(metric_date DESC);
CREATE INDEX idx_supplier_risk_scores_supplier ON supplier_risk_scores(supplier_id);
CREATE INDEX idx_supplier_risk_scores_date ON supplier_risk_scores(risk_assessment_date DESC);
CREATE INDEX idx_supplier_risk_alerts_supplier ON supplier_risk_alerts(supplier_id);
CREATE INDEX idx_supplier_risk_alerts_created ON supplier_risk_alerts(created_at DESC);
