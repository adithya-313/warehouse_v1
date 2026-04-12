-- ============================================================
-- 012_gst_shrinkage_test_data.sql — Test Data for GST & Shrinkage
-- ============================================================

-- Insert sample GST transactions
INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, e_way_bill_number, state_from, state_to, reconciled, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'inbound',
  'c1000000-0000-0000-0000-000000000002',
  500, 18.00, 50000.00, 9000.00, 'INV-2026-001', 'EWB123456789012', 'MH', 'MH', true, 'system'
ON CONFLICT DO NOTHING;

INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, e_way_bill_number, state_from, state_to, reconciled, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  'outbound',
  'c1000000-0000-0000-0000-000000000003',
  200, 12.00, 12000.00, 1440.00, 'INV-2026-002', 'EWB987654321098', 'MH', 'KA', true, 'system'
ON CONFLICT DO NOTHING;

INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, state_from, state_to, reconciled, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'transfer',
  'c1000000-0000-0000-0000-000000000008',
  1000, 5.00, 5000.00, 250.00, 'TRF-2026-001', 'MH', 'DL', true, 'system'
ON CONFLICT DO NOTHING;

INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, e_way_bill_number, state_from, state_to, reconciled, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000001',
  'inbound',
  'c1000000-0000-0000-0000-000000000014',
  300, 28.00, 30000.00, 8400.00, 'INV-2026-003', 'EWB456789123012', 'MH', 'MH', true, 'system'
ON CONFLICT DO NOTHING;

-- Discrepancy transactions (for testing reconciliation)
INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, state_from, state_to, reconciled, discrepancy_notes, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000001',
  'outbound',
  'c1000000-0000-0000-0000-000000000009',
  50, 18.00, 5000.00, 900.00, 'INV-2026-004', 'MH', 'GJ', false, 'Missing e-way bill for inter-state transfer', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO gst_transactions (id, warehouse_id, transaction_type, product_id, quantity, gst_rate, taxable_amount, gst_amount, invoice_number, state_from, state_to, reconciled, discrepancy_notes, logged_by)
SELECT 
  'e1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000001',
  'inbound',
  'c1000000-0000-0000-0000-000000000017',
  100, 12.00, 6000.00, 720.00, 'INV-2026-005', 'MH', 'MH', false, 'GST rate mismatch: expected 18%, got 12%', 'system'
ON CONFLICT DO NOTHING;

-- Sample shrinkage alerts
INSERT INTO shrinkage_alerts (id, warehouse_id, product_id, alert_type, expected_qty, actual_qty, variance_qty, variance_pct, bin_location, zone, aisle, severity, resolution_status, flagged_by_name, created_at)
SELECT 
  'f1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'qty_mismatch',
  100.00, 85.00, 15.00, 0.1500,
  'A-01-03', 'A', '01',
  'critical',
  'investigating',
  'system',
  CURRENT_DATE - 2
ON CONFLICT DO NOTHING;

INSERT INTO shrinkage_alerts (id, warehouse_id, product_id, alert_type, expected_qty, actual_qty, variance_qty, variance_pct, bin_location, zone, aisle, severity, resolution_status, flagged_by_name, created_at)
SELECT 
  'f1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000008',
  'ghost_inventory',
  500.00, 0.00, 500.00, 1.0000,
  'B-02-05', 'B', '02',
  'high',
  'open',
  'system',
  CURRENT_DATE - 1
ON CONFLICT DO NOTHING;

INSERT INTO shrinkage_alerts (id, warehouse_id, product_id, alert_type, expected_qty, actual_qty, variance_qty, variance_pct, bin_location, zone, aisle, severity, resolution_status, flagged_by_name, created_at)
SELECT 
  'f1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000014',
  'unauthorized_removal',
  50.00, 45.00, 5.00, 0.1000,
  'C-03-02', 'C', '03',
  'high',
  'open',
  'system',
  CURRENT_DATE - 1
ON CONFLICT DO NOTHING;

INSERT INTO shrinkage_alerts (id, warehouse_id, product_id, alert_type, expected_qty, actual_qty, variance_qty, variance_pct, bin_location, zone, aisle, severity, resolution_status, flagged_by_name, resolution_notes, resolved_by_name, created_at, resolved_at)
SELECT 
  'f1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000003',
  'scan_error',
  25.00, 25.00, 0.00, 0.0000,
  'A-01-01', 'A', '01',
  'low',
  'false_alarm',
  'system',
  'False positive: bin label was damaged, rescanned correctly',
  'warehouse_manager',
  CURRENT_DATE - 5,
  CURRENT_DATE - 4
ON CONFLICT DO NOTHING;

INSERT INTO shrinkage_alerts (id, warehouse_id, product_id, alert_type, expected_qty, actual_qty, variance_qty, variance_pct, bin_location, zone, aisle, severity, resolution_status, flagged_by_name, resolution_notes, resolved_by_name, created_at, resolved_at)
SELECT 
  'f1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000017',
  'qty_mismatch',
  200.00, 195.00, 5.00, 0.0250,
  'D-04-01', 'D', '04',
  'medium',
  'resolved',
  'system',
  'Normal shelf settling, no theft. Recount confirmed.',
  'warehouse_manager',
  CURRENT_DATE - 10,
  CURRENT_DATE - 8
ON CONFLICT DO NOTHING;

-- Sample reconciliation log
INSERT INTO gst_reconciliation_log (id, warehouse_id, reconciliation_date, total_transactions, matched_count, discrepancy_count, gst_amount_variance, total_taxable_amount, total_gst_amount, audit_status, created_at)
SELECT 
  '71000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 1,
  10, 8, 2, 360.00, 150000.00, 27000.00,
  'needs_review',
  CURRENT_DATE - 1
ON CONFLICT (warehouse_id, reconciliation_date) DO NOTHING;

INSERT INTO gst_reconciliation_log (id, warehouse_id, reconciliation_date, total_transactions, matched_count, discrepancy_count, gst_amount_variance, total_taxable_amount, total_gst_amount, audit_status, created_at)
SELECT 
  '71000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 8,
  25, 25, 0, 0.00, 380000.00, 68400.00,
  'compliant',
  CURRENT_DATE - 8
ON CONFLICT (warehouse_id, reconciliation_date) DO NOTHING;

-- Update products with GST rates and costs
UPDATE products SET default_gst_rate = 18, unit_cost = 100.00 WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE products SET default_gst_rate = 12, unit_cost = 60.00 WHERE id = 'c1000000-0000-0000-0000-000000000003';
UPDATE products SET default_gst_rate = 5, unit_cost = 5.00 WHERE id = 'c1000000-0000-0000-0000-000000000008';
UPDATE products SET default_gst_rate = 28, unit_cost = 100.00 WHERE id = 'c1000000-0000-0000-0000-000000000014';
UPDATE products SET default_gst_rate = 18, unit_cost = 80.00 WHERE id = 'c1000000-0000-0000-0000-000000000009';
UPDATE products SET default_gst_rate = 12, unit_cost = 50.00 WHERE id = 'c1000000-0000-0000-0000-000000000017';
UPDATE products SET default_gst_rate = 5, unit_cost = 45.00 WHERE id = 'c1000000-0000-0000-0000-000000000001';
UPDATE products SET default_gst_rate = 18, unit_cost = 250.00 WHERE id = 'c1000000-0000-0000-0000-000000000005';
