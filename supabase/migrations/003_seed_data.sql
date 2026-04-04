-- ============================================================
-- 003_seed_data.sql — 20 demo products for visual testing
-- Run AFTER 001_schema.sql AND 002_seed.sql
-- ============================================================

-- ============================================================
-- PRODUCTS  (20 items across FMCG, Pharma, Electronics)
-- ============================================================
INSERT INTO products (id, name, category, unit, expiry_date, supplier_id) VALUES
-- FMCG
  ('c1000000-0000-0000-0000-000000000001', 'Basmati Rice 5kg',       'FMCG',        'bag',    '2026-12-01', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'Refined Sunflower Oil',  'FMCG',        'litre',  '2026-06-15', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'Whole Wheat Flour 10kg', 'FMCG',        'bag',    '2026-09-30', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'Toor Dal 1kg',           'FMCG',        'kg',     '2027-03-01', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'Packaged Drinking Water', 'FMCG',       'case',   '2026-05-01', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000006', 'Tomato Ketchup 1L',      'FMCG',        'bottle', '2026-04-20', 'b1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000007', 'Butter 500g',            'FMCG',        'pack',   '2026-04-10', 'b1000000-0000-0000-0000-000000000001'),
-- Pharma
  ('c1000000-0000-0000-0000-000000000008', 'Paracetamol 500mg',      'Pharma',      'strip',  '2026-08-01', 'b1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000009', 'Amoxicillin 250mg',      'Pharma',      'strip',  '2026-05-20', 'b1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000010', 'Cough Syrup 100ml',      'Pharma',      'bottle', '2026-04-15', 'b1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000011', 'Vitamin C Tablets',      'Pharma',      'strip',  '2027-01-01', 'b1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000012', 'Hand Sanitizer 500ml',   'Pharma',      'bottle', '2026-07-30', 'b1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000013', 'Surgical Gloves M',      'Pharma',      'box',    '2027-12-31', 'b1000000-0000-0000-0000-000000000002'),
-- Electronics
  ('c1000000-0000-0000-0000-000000000014', 'USB-C Charging Cable',   'Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000015', 'AA Batteries 8pk',       'Electronics', 'pack',   '2030-01-01', 'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000016', 'HDMI Cable 2m',          'Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000017', 'Wireless Mouse',         'Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000018', 'LED Desk Lamp',          'Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000019', 'Power Bank 10000mAh',    'Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000020', 'Laptop Stand Adjustable','Electronics', 'unit',   NULL,         'b1000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INVENTORY (products spread across 3 warehouses)
-- ============================================================
INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_point) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 850,  200),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 320,  150),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 60,   200), -- below reorder
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 1200, 300),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 25,   100), -- critical stock
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 180,  100),
  ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 40,   80),  -- below reorder
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 5000, 1000),
  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 150,  200), -- below reorder
  ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 30,   50),  -- below reorder + expiry risk
  ('c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 900,  200),
  ('c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003', 600,  150),
  ('c1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003', 240,  100),
  ('c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 80,   50),
  ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 2000, 500),
  ('c1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003', 0,    30),  -- dead stock
  ('c1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000003', 5,    20),  -- critical
  ('c1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000001', 120,  40),
  ('c1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000001', 45,   30),
  ('c1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000001', 0,    10)   -- dead stock
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

-- ============================================================
-- STOCK MOVEMENTS (last 30 days, realistic daily patterns)
-- ============================================================
-- Basmati Rice — Fast moving
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000001','in',  500,'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 29),
  ('c1000000-0000-0000-0000-000000000001','out', 45, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000001','out', 60, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000001','out', 55, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000001','out', 70, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000001','out', 80, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5),
  ('c1000000-0000-0000-0000-000000000001','out', 90, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 1);
-- Packaged Water — Critical stock
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000005','in',  200,'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 28),
  ('c1000000-0000-0000-0000-000000000005','out', 30, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000005','out', 50, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000005','out', 60, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 3),
  ('c1000000-0000-0000-0000-000000000005','out', 35, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 1);
-- Cough Syrup — Expiry risk + low stock
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000010','in',  100,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 60),
  ('c1000000-0000-0000-0000-000000000010','out', 20, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 40),
  ('c1000000-0000-0000-0000-000000000010','out', 25, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000010','out', 25, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 5);
-- Sunflower Oil — Slow moving
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000002','in',  400,'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000002','out', 30, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000002','out', 50, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5);
-- HDMI Cable — Dead stock (no recent movement)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000016','in',  50, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 90);
-- Wireless Mouse — Critical stock, fast moving
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000017','in',  100,'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000017','out', 30, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000017','out', 35, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000017','out', 30, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 2);
-- Amoxicillin — Below reorder, expiry risk
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000009','in',  500,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 60),
  ('c1000000-0000-0000-0000-000000000009','out', 100,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 40),
  ('c1000000-0000-0000-0000-000000000009','out', 150,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000009','out', 100,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 5);
-- Paracetamol — Healthy, high stock
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000008','in',  8000,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000008','out', 1000,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000008','out', 1000,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000008','out', 1000,'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 3);

-- ============================================================
-- PRODUCT ANALYTICS (pre-computed for demo dashboard display)
-- ============================================================
INSERT INTO product_analytics (product_id, avg_daily_demand, days_to_stockout, expiry_risk_score, health_score, health_label, classification, demand_trend) VALUES
  ('c1000000-0000-0000-0000-000000000001', 14.3,  59.4, 2,   88, 'Healthy',   'Fast Moving',  'rising'),
  ('c1000000-0000-0000-0000-000000000002', 2.7,   118.5,10,  76, 'Monitor',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000003', 0.0,   NULL, 5,   38, 'Critical',  'Dead Stock',   'falling'),
  ('c1000000-0000-0000-0000-000000000004', 0.0,   NULL, 1,   82, 'Healthy',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000005', 29.2,  0.9,  65,  22, 'Critical',  'Fast Moving',  'rising'),
  ('c1000000-0000-0000-0000-000000000006', 0.0,   NULL, 88,  35, 'Critical',  'Expiry Risk',  'falling'),
  ('c1000000-0000-0000-0000-000000000007', 0.0,   NULL, 95,  18, 'Critical',  'Expiry Risk',  'falling'),
  ('c1000000-0000-0000-0000-000000000008', 100.0, 50.0, 4,   90, 'Healthy',   'Fast Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000009', 9.2,   16.3, 62,  42, 'At Risk',   'Expiry Risk',  'falling'),
  ('c1000000-0000-0000-0000-000000000010', 3.3,   9.1,  92,  24, 'Critical',  'Expiry Risk',  'falling'),
  ('c1000000-0000-0000-0000-000000000011', 0.0,   NULL, 2,   80, 'Healthy',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000012', 0.0,   NULL, 12,  78, 'Monitor',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000013', 0.0,   NULL, 1,   85, 'Healthy',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000014', 0.0,   NULL, 0,   66, 'Monitor',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000015', 0.0,   NULL, 0,   91, 'Healthy',   'Fast Moving',  'rising'),
  ('c1000000-0000-0000-0000-000000000016', 0.0,   NULL, 0,   30, 'Critical',  'Dead Stock',   'falling'),
  ('c1000000-0000-0000-0000-000000000017', 15.8,  0.3,  0,   15, 'Critical',  'Fast Moving',  'rising'),
  ('c1000000-0000-0000-0000-000000000018', 0.0,   NULL, 0,   78, 'Monitor',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000019', 0.0,   NULL, 0,   72, 'Monitor',   'Slow Moving',  'stable'),
  ('c1000000-0000-0000-0000-000000000020', 0.0,   NULL, 0,   28, 'Critical',  'Dead Stock',   'falling')
ON CONFLICT (product_id) DO UPDATE
  SET avg_daily_demand  = EXCLUDED.avg_daily_demand,
      days_to_stockout  = EXCLUDED.days_to_stockout,
      expiry_risk_score = EXCLUDED.expiry_risk_score,
      health_score      = EXCLUDED.health_score,
      health_label      = EXCLUDED.health_label,
      classification    = EXCLUDED.classification,
      demand_trend      = EXCLUDED.demand_trend,
      updated_at        = NOW();

-- ============================================================
-- ALERTS  (representative active alerts for demo)
-- ============================================================
INSERT INTO alerts (product_id, type, severity, message, resolved) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'stockout',     'critical', 'Packaged Drinking Water: ~1 day to stockout. Immediate reorder required.',         false),
  ('c1000000-0000-0000-0000-000000000017', 'stockout',     'critical', 'Wireless Mouse: less than 1 day to stockout. Reorder 50 units from TechParts.',    false),
  ('c1000000-0000-0000-0000-000000000007', 'expiry',       'critical', 'Butter 500g: expires in 6 days. Suggest 30% discount to clear stock.',              false),
  ('c1000000-0000-0000-0000-000000000010', 'expiry',       'critical', 'Cough Syrup 100ml: expires in 11 days, low stock. Discount + alert pharmacy team.', false),
  ('c1000000-0000-0000-0000-000000000006', 'expiry',       'warning',  'Tomato Ketchup 1L: expires in 16 days. Consider 15% discount.',                    false),
  ('c1000000-0000-0000-0000-000000000009', 'stockout',     'warning',  'Amoxicillin 250mg: 16 days to stockout. Reorder suggested.',                       false),
  ('c1000000-0000-0000-0000-000000000003', 'dead_stock',   'info',     'Whole Wheat Flour 10kg: no movement in 30+ days. Consider warehouse transfer.',     false),
  ('c1000000-0000-0000-0000-000000000016', 'dead_stock',   'info',     'HDMI Cable 2m: no movement in 90+ days. Consider return to supplier.',              false),
  ('c1000000-0000-0000-0000-000000000020', 'dead_stock',   'info',     'Laptop Stand Adjustable: no movement. Consider discount or supplier return.',       false),
  ('c1000000-0000-0000-0000-000000000005', 'health',       'critical', 'Packaged Drinking Water: Health Score 22 — Critical. Immediate action required.',   false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ACTIONS  (recommendations linked to demo alerts)
-- ============================================================
-- We need the alert IDs — use a CTE to insert actions
WITH alert_ids AS (
  SELECT id, product_id, type FROM alerts WHERE resolved = false ORDER BY created_at LIMIT 10
)
INSERT INTO actions (alert_id, recommendation)
SELECT
  a.id,
  CASE a.type
    WHEN 'stockout'   THEN 'Reorder immediately from assigned supplier. Suggested quantity: 3x reorder point.'
    WHEN 'expiry'     THEN 'Apply 20–30% discount, move to front-of-shelf. Notify sales team.'
    WHEN 'dead_stock' THEN 'Transfer to Distribution Hub or initiate supplier return within 7 days.'
    WHEN 'health'     THEN 'Review all risk factors. Escalate to warehouse manager.'
    ELSE 'Review product status and take appropriate action.'
  END
FROM alert_ids a
ON CONFLICT DO NOTHING;

-- ============================================================
-- SYNC LOG  (show a realistic last-sync entry)
-- ============================================================
INSERT INTO sync_logs (source, status, records_synced, synced_at) VALUES
  ('csv',   'success', 20, NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;
