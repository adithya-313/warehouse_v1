-- Test supplier risk insertion

-- 1. Create a test supplier
INSERT INTO suppliers (
    id, name, contact_person, email, phone, payment_terms, category, status
) VALUES (
    'b2000000-0000-0000-0000-000000000001', 'Test Supplier Inc', 'John Doe', 'john@test.com', '1234567890', 30, 'primary', 'active'
) ON CONFLICT DO NOTHING;

-- 2. Insert metrics data (30 days ago to today)
DO $$ 
DECLARE
  i INT;
  d DATE;
BEGIN
  FOR i IN 0..29 LOOP
    d := CURRENT_DATE - i;
    INSERT INTO supplier_metrics (
      supplier_id, metric_date, on_time_delivery_pct, quality_score, avg_lead_time_days, order_cancellation_pct
    ) VALUES (
      'b2000000-0000-0000-0000-000000000001', d, 95.00, 98.00, 5.5, 2.00
    );
  END LOOP;
END $$;

-- 3. Verify unique constraint works (try duplicate date → should fail)
-- Uncommenting the next line would cause an error:
-- INSERT INTO supplier_metrics (supplier_id, metric_date, on_time_delivery_pct, quality_score, order_cancellation_pct) VALUES ('b2000000-0000-0000-0000-000000000001', CURRENT_DATE, 90.00, 90.00, 0);

-- 4. Verify risk_score insert works
INSERT INTO supplier_risk_scores (
  supplier_id, risk_assessment_date, financial_risk_score, operational_risk_score, market_risk_score, overall_risk_score, failure_probability_6m, risk_level, key_risk_factors, recommendation
) VALUES (
  'b2000000-0000-0000-0000-000000000001', CURRENT_DATE, 20.00, 15.00, 30.00, 21.60, 5.00, 'low', '["stable_delivery"]'::jsonb, 'Maintain current order volume'
);

-- 5. Insert alert
INSERT INTO supplier_risk_alerts (
  supplier_id, alert_type, severity, message
) VALUES (
  'b2000000-0000-0000-0000-000000000001', 'delivery_degradation', 'low', 'Delivery performance slightly dipped'
);

-- Show count to verify successful insertions
-- SELECT count(*) FROM supplier_metrics WHERE supplier_id = 'b2000000-0000-0000-0000-000000000001';
-- SELECT * FROM supplier_risk_scores WHERE supplier_id = 'b2000000-0000-0000-0000-000000000001';
-- SELECT * FROM supplier_risk_alerts WHERE supplier_id = 'b2000000-0000-0000-0000-000000000001';
