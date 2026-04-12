-- ============================================================
-- warehouse_data.sql — Complete Test Data for MVP Demo
-- Run AFTER all migration files (001-008)
-- ============================================================

-- ============================================================
-- SECTION 1: ENHANCED SUPPLIERS WITH PERFORMANCE DATA
-- ============================================================

-- Update existing suppliers with full details
UPDATE suppliers SET 
  contact_person = 'Rajesh Sharma',
  email = 'rajesh@reliance.in',
  phone = '+91 9876543210',
  payment_terms = 30,
  category = 'primary',
  rating = 4
WHERE id = 'b1000000-0000-0000-0000-000000000001';

UPDATE suppliers SET 
  contact_person = 'Dr. Priya Mehta',
  email = 'priya@pharmadirect.in',
  phone = '+91 9876543211',
  payment_terms = 15,
  category = 'primary',
  rating = 5
WHERE id = 'b1000000-0000-0000-0000-000000000002';

UPDATE suppliers SET 
  contact_person = 'Vikram Singh',
  email = 'vikram@techparts.in',
  phone = '+91 9876543212',
  payment_terms = 45,
  category = 'secondary',
  rating = 3
WHERE id = 'b1000000-0000-0000-0000-000000000003';

-- Add 2 more suppliers with varying performance
INSERT INTO suppliers (id, name, contact_person, email, phone, payment_terms, avg_lead_time_days, category, rating, status) VALUES
  ('b1000000-0000-0000-0000-000000000004', 'GlobalFoods Ltd.', 'Anita Desai', 'anita@globalfoods.in', '+91 9876543213', 30, 7, 'primary', 4, 'active'),
  ('b1000000-0000-0000-0000-000000000005', 'Budget Supplies Co.', 'Mohammed Khan', 'mohammed@budgetsupplies.in', '+91 9876543214', 60, 14, 'emergency', 2, 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 2: BIN LOCATIONS FOR EACH WAREHOUSE
-- ============================================================

-- Main Warehouse bins (Zone A-D)
INSERT INTO bin_locations (warehouse_id, aisle, rack, bin, zone, product_id, qty_on_hand) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'A1', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000001', 400),
  ('a1000000-0000-0000-0000-000000000001', 'A1', '01', 'L2', 'A', 'c1000000-0000-0000-0000-000000000002', 200),
  ('a1000000-0000-0000-0000-000000000001', 'A1', '02', 'L1', 'A', 'c1000000-0000-0000-0000-000000000003', 30),
  ('a1000000-0000-0000-0000-000000000001', 'A2', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000004', 600),
  ('a1000000-0000-0000-0000-000000000001', 'A2', '02', 'L1', 'A', 'c1000000-0000-0000-0000-000000000005', 15),
  ('a1000000-0000-0000-0000-000000000001', 'B1', '01', 'L1', 'B', 'c1000000-0000-0000-0000-000000000018', 80),
  ('a1000000-0000-0000-0000-000000000001', 'B1', '02', 'L1', 'B', 'c1000000-0000-0000-0000-000000000019', 30),
  ('a1000000-0000-0000-0000-000000000001', 'B2', '01', 'L1', 'B', 'c1000000-0000-0000-0000-000000000020', 0),
  ('a1000000-0000-0000-0000-000000000001', 'C1', '01', 'L1', 'C', 'c1000000-0000-0000-0000-000000000014', 50),
  ('a1000000-0000-0000-0000-000000000001', 'C1', '02', 'L1', 'C', 'c1000000-0000-0000-0000-000000000015', 1500)
ON CONFLICT (warehouse_id, aisle, rack, bin) DO NOTHING;

-- Cold Storage bins (Zone A-B, Pharma products)
INSERT INTO bin_locations (warehouse_id, aisle, rack, bin, zone, product_id, qty_on_hand) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'A1', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000006', 100),
  ('a1000000-0000-0000-0000-000000000002', 'A1', '01', 'L2', 'A', 'c1000000-0000-0000-0000-000000000007', 25),
  ('a1000000-0000-0000-0000-000000000002', 'A2', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000008', 3000),
  ('a1000000-0000-0000-0000-000000000002', 'A2', '02', 'L1', 'A', 'c1000000-0000-0000-0000-000000000009', 80),
  ('a1000000-0000-0000-0000-000000000002', 'A3', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000010', 20),
  ('a1000000-0000-0000-0000-000000000002', 'B1', '01', 'L1', 'B', 'c1000000-0000-0000-0000-000000000011', 500)
ON CONFLICT (warehouse_id, aisle, rack, bin) DO NOTHING;

-- Distribution Hub bins (Zone A-C)
INSERT INTO bin_locations (warehouse_id, aisle, rack, bin, zone, product_id, qty_on_hand) VALUES
  ('a1000000-0000-0000-0000-000000000003', 'A1', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000012', 400),
  ('a1000000-0000-0000-0000-000000000003', 'A1', '02', 'L1', 'A', 'c1000000-0000-0000-0000-000000000013', 150),
  ('a1000000-0000-0000-0000-000000000003', 'A2', '01', 'L1', 'A', 'c1000000-0000-0000-0000-000000000014', 30),
  ('a1000000-0000-0000-0000-000000000003', 'B1', '01', 'L1', 'B', 'c1000000-0000-0000-0000-000000000015', 500),
  ('a1000000-0000-0000-0000-000000000003', 'B1', '02', 'L1', 'B', 'c1000000-0000-0000-0000-000000000016', 0),
  ('a1000000-0000-0000-0000-000000000003', 'B2', '01', 'L1', 'B', 'c1000000-0000-0000-0000-000000000017', 5)
ON CONFLICT (warehouse_id, aisle, rack, bin) DO NOTHING;

-- ============================================================
-- SECTION 3: 30-DAY STOCK MOVEMENTS (STATIC DATES FOR CONSISTENCY)
-- ============================================================

-- Basmati Rice (Fast Mover, Rising Demand)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'out', 35, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000001', 'out', 42, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 28),
  ('c1000000-0000-0000-0000-000000000001', 'out', 48, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000001', 'out', 55, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 22),
  ('c1000000-0000-0000-0000-000000000001', 'out', 60, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000001', 'out', 58, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 18),
  ('c1000000-0000-0000-0000-000000000001', 'out', 65, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000001', 'out', 72, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 12),
  ('c1000000-0000-0000-0000-000000000001', 'out', 78, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000001', 'out', 85, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 8),
  ('c1000000-0000-0000-0000-000000000001', 'out', 90, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5),
  ('c1000000-0000-0000-0000-000000000001', 'out', 95, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 3),
  ('c1000000-0000-0000-0000-000000000001', 'out', 100, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

-- Packaged Water (Critical Stock, Fast Mover)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'out', 25, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000005', 'out', 30, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000005', 'out', 35, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000005', 'out', 40, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000005', 'out', 45, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000005', 'out', 55, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5),
  ('c1000000-0000-0000-0000-000000000005', 'out', 65, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

-- Wheat Flour (Slow Mover)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'out', 8, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000003', 'out', 10, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000003', 'out', 12, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- Toor Dal (Stable Demand)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000004', 'out', 15, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000004', 'out', 18, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000004', 'out', 20, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000004', 'out', 22, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000004', 'out', 25, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000004', 'out', 28, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5),
  ('c1000000-0000-0000-0000-000000000004', 'out', 30, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

-- Sunflower Oil (Slow Moving)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'out', 25, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000002', 'out', 30, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000002', 'out', 35, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000002', 'out', 40, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000002', 'out', 45, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000002', 'out', 50, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- Paracetamol (Fast Mover, Pharma)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000008', 'out', 900, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000008', 'out', 950, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000008', 'out', 1000, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000008', 'out', 1050, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000008', 'out', 1100, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000008', 'out', 1150, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- Amoxicillin (At Risk - expiry soon)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000009', 'out', 55, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000009', 'out', 60, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000009', 'out', 65, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000009', 'out', 70, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000009', 'out', 75, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000009', 'out', 80, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- Cough Syrup (Expiry Risk)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000010', 'out', 12, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000010', 'out', 10, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000010', 'out', 8, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000010', 'out', 6, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000010', 'out', 5, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000010', 'out', 4, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- Vitamin C (Slow Moving)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000011', 'out', 25, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 28),
  ('c1000000-0000-0000-0000-000000000011', 'out', 30, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000011', 'out', 35, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 12),
  ('c1000000-0000-0000-0000-000000000011', 'out', 40, 'a1000000-0000-0000-0000-000000000002', CURRENT_DATE - 4)
ON CONFLICT DO NOTHING;

-- Wireless Mouse (Critical, Fast Mover)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000017', 'out', 12, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000017', 'out', 15, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000017', 'out', 18, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000017', 'out', 20, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000017', 'out', 22, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000017', 'out', 25, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 5),
  ('c1000000-0000-0000-0000-000000000017', 'out', 28, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

-- USB-C Cable (Dead Stock - minimal movement)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000014', 'out', 2, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000014', 'out', 1, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 15)
ON CONFLICT DO NOTHING;

-- AA Batteries (Fast Mover)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000015', 'out', 60, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000015', 'out', 75, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000015', 'out', 80, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000015', 'out', 90, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000015', 'out', 100, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000015', 'out', 110, 'a1000000-0000-0000-0000-000000000003', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- LED Desk Lamp (Slow Moving)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000018', 'out', 3, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 28),
  ('c1000000-0000-0000-0000-000000000018', 'out', 4, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000018', 'out', 5, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 12),
  ('c1000000-0000-0000-0000-000000000018', 'out', 6, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 4)
ON CONFLICT DO NOTHING;

-- Power Bank (Stable Demand)
INSERT INTO stock_movements (product_id, type, quantity, warehouse_id, date) VALUES
  ('c1000000-0000-0000-0000-000000000019', 'out', 8, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 30),
  ('c1000000-0000-0000-0000-000000000019', 'out', 10, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 25),
  ('c1000000-0000-0000-0000-000000000019', 'out', 12, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 20),
  ('c1000000-0000-0000-0000-000000000019', 'out', 14, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 15),
  ('c1000000-0000-0000-0000-000000000019', 'out', 16, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 10),
  ('c1000000-0000-0000-0000-000000000019', 'out', 18, 'a1000000-0000-0000-0000-000000000001', CURRENT_DATE - 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 4: SUPPLIER ORDERS (30 DAYS HISTORY)
-- ============================================================

-- Good Supplier: Pharma Direct (95% on-time, no quality issues)
INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000008',
  CURRENT_DATE - 28,
  CURRENT_DATE - 25,
  CURRENT_DATE - 25,
  5000, 5000, 0.50, 2500.00, true, false, 'received', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000008',
  CURRENT_DATE - 18,
  CURRENT_DATE - 15,
  CURRENT_DATE - 15,
  5000, 5000, 0.50, 2500.00, true, false, 'received', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000009',
  CURRENT_DATE - 20,
  CURRENT_DATE - 17,
  CURRENT_DATE - 18,  -- 1 day late
  1000, 980, 2.50, 2450.00, false, false, 'received', 'system'
ON CONFLICT DO NOTHING;

-- Mediocre Supplier: TechParts (70% on-time)
INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000004',
  'b1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000014',
  CURRENT_DATE - 25,
  CURRENT_DATE - 20,
  CURRENT_DATE - 20,
  100, 100, 8.00, 800.00, true, false, 'received', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000005',
  'b1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000015',
  CURRENT_DATE - 22,
  CURRENT_DATE - 17,
  CURRENT_DATE - 22,  -- 5 days late!
  2000, 1950, 1.50, 2925.00, false, true, 'received', 'system'  -- Quality issues
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000006',
  'b1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000017',
  CURRENT_DATE - 15,
  CURRENT_DATE - 10,
  CURRENT_DATE - 12,  -- 2 days late
  200, 200, 15.00, 3000.00, false, false, 'received', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000007',
  'b1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000014',
  CURRENT_DATE - 10,
  CURRENT_DATE - 5,
  CURRENT_DATE - 5,
  100, 100, 8.00, 800.00, true, false, 'received', 'system'
ON CONFLICT DO NOTHING;

-- Poor Supplier: Budget Supplies (40% on-time, quality issues)
INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000008',
  'b1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000002',
  CURRENT_DATE - 20,
  CURRENT_DATE - 15,
  CURRENT_DATE - 25,  -- 10 days late!
  500, 450, 12.00, 5400.00, false, true, 'received', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, actual_delivery, ordered_qty, received_qty, unit_cost, total_cost, on_time, quality_issues, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000009',
  'b1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000003',
  CURRENT_DATE - 18,
  CURRENT_DATE - 13,
  CURRENT_DATE - 20,  -- 7 days late
  200, 180, 8.00, 1440.00, false, true, 'received', 'system'
ON CONFLICT DO NOTHING;

-- Pending Orders
INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, ordered_qty, unit_cost, total_cost, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000010',
  'b1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 2,
  CURRENT_DATE + 3,
  500, 15.00, 7500.00, 'pending', 'system'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_orders (id, supplier_id, product_id, order_date, expected_delivery, ordered_qty, unit_cost, total_cost, status, logged_by)
SELECT 
  'd1000000-0000-0000-0000-000000000011',
  'b1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000005',
  CURRENT_DATE - 1,
  CURRENT_DATE + 2,
  300, 5.00, 1500.00, 'pending', 'system'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 5: SUPPLIER PERFORMANCE (Pre-computed)
-- ============================================================

-- Pharma Direct: 75% on-time (1 late out of 4), 100% quality
INSERT INTO supplier_performance (supplier_id, on_time_delivery_pct, quality_score, avg_lead_time_days, last_30_days_orders, total_cost_30_days, reliability_score)
VALUES ('b1000000-0000-0000-0000-000000000002', 75.00, 100.00, 4.5, 4, 9950.00, 85.00)
ON CONFLICT (supplier_id) DO UPDATE SET
  on_time_delivery_pct = 75.00,
  quality_score = 100.00,
  avg_lead_time_days = 4.5,
  last_30_days_orders = 4,
  total_cost_30_days = 9950.00,
  reliability_score = 85.00;

-- TechParts: 50% on-time (2 late out of 4), 75% quality (1 quality issue)
INSERT INTO supplier_performance (supplier_id, on_time_delivery_pct, quality_score, avg_lead_time_days, last_30_days_orders, total_cost_30_days, reliability_score)
VALUES ('b1000000-0000-0000-0000-000000000003', 50.00, 75.00, 8.5, 4, 7525.00, 60.00)
ON CONFLICT (supplier_id) DO UPDATE SET
  on_time_delivery_pct = 50.00,
  quality_score = 75.00,
  avg_lead_time_days = 8.5,
  last_30_days_orders = 4,
  total_cost_30_days = 7525.00,
  reliability_score = 60.00;

-- Budget Supplies: 0% on-time, 50% quality (2 quality issues)
INSERT INTO supplier_performance (supplier_id, on_time_delivery_pct, quality_score, avg_lead_time_days, last_30_days_orders, total_cost_30_days, reliability_score)
VALUES ('b1000000-0000-0000-0000-000000000005', 0.00, 50.00, 12.0, 2, 6840.00, 30.00)
ON CONFLICT (supplier_id) DO UPDATE SET
  on_time_delivery_pct = 0.00,
  quality_score = 50.00,
  avg_lead_time_days = 12.0,
  last_30_days_orders = 2,
  total_cost_30_days = 6840.00,
  reliability_score = 30.00;

-- Reliance: 100% on-time (no orders yet in 30d)
INSERT INTO supplier_performance (supplier_id, on_time_delivery_pct, quality_score, avg_lead_time_days, last_30_days_orders, total_cost_30_days, reliability_score)
VALUES ('b1000000-0000-0000-0000-000000000001', 100.00, 100.00, 5.0, 1, 7500.00, 100.00)
ON CONFLICT (supplier_id) DO UPDATE SET
  on_time_delivery_pct = 100.00,
  quality_score = 100.00,
  avg_lead_time_days = 5.0,
  last_30_days_orders = 1,
  total_cost_30_days = 7500.00,
  reliability_score = 100.00;

-- GlobalFoods: 100% on-time
INSERT INTO supplier_performance (supplier_id, on_time_delivery_pct, quality_score, avg_lead_time_days, last_30_days_orders, total_cost_30_days, reliability_score)
VALUES ('b1000000-0000-0000-0000-000000000004', 100.00, 100.00, 7.0, 0, 0.00, 100.00)
ON CONFLICT (supplier_id) DO UPDATE SET
  on_time_delivery_pct = 100.00,
  quality_score = 100.00,
  avg_lead_time_days = 7.0,
  last_30_days_orders = 0,
  total_cost_30_days = 0.00,
  reliability_score = 100.00;

-- ============================================================
-- SECTION 6: DEMAND FORECASTS (Pre-generated)
-- ============================================================

-- Fast Movers with Rising Demand
INSERT INTO demand_forecast (product_id, warehouse_id, days_ahead, predicted_qty, confidence_lower, confidence_upper, confidence_score, trend)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 30, 1800, 1400, 2200, 78.5, 'rising'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 60, 3600, 2800, 4400, 72.3, 'rising'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 90, 5400, 4200, 6600, 68.1, 'rising'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 30, 1200, 900, 1500, 65.2, 'rising'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 60, 2400, 1800, 3000, 58.7, 'rising'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 90, 3600, 2700, 4500, 52.4, 'rising'),
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 30, 25000, 20000, 30000, 82.1, 'stable'),
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 60, 50000, 40000, 60000, 78.5, 'stable'),
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 90, 75000, 60000, 90000, 75.2, 'stable')
ON CONFLICT (product_id, warehouse_id, days_ahead) DO UPDATE SET
  predicted_qty = EXCLUDED.predicted_qty,
  confidence_lower = EXCLUDED.confidence_lower,
  confidence_upper = EXCLUDED.confidence_upper,
  confidence_score = EXCLUDED.confidence_score,
  trend = EXCLUDED.trend,
  forecast_date = CURRENT_DATE;

-- Slow Movers with Falling Demand
INSERT INTO demand_forecast (product_id, warehouse_id, days_ahead, predicted_qty, confidence_lower, confidence_upper, confidence_score, trend)
VALUES
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 30, 45, 20, 70, 45.2, 'falling'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 60, 90, 40, 140, 38.7, 'falling'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 90, 135, 60, 210, 32.1, 'falling'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 30, 600, 450, 750, 68.4, 'stable'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 60, 1200, 900, 1500, 62.1, 'stable'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 90, 1800, 1350, 2250, 55.8, 'stable'),
  ('c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 30, 25, 10, 40, 35.2, 'falling'),
  ('c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 60, 50, 20, 80, 28.7, 'falling'),
  ('c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 90, 75, 30, 120, 22.4, 'falling')
ON CONFLICT (product_id, warehouse_id, days_ahead) DO UPDATE SET
  predicted_qty = EXCLUDED.predicted_qty,
  confidence_lower = EXCLUDED.confidence_lower,
  confidence_upper = EXCLUDED.confidence_upper,
  confidence_score = EXCLUDED.confidence_score,
  trend = EXCLUDED.trend,
  forecast_date = CURRENT_DATE;

-- Overstock products
INSERT INTO demand_forecast (product_id, warehouse_id, days_ahead, predicted_qty, confidence_lower, confidence_upper, confidence_score, trend)
VALUES
  ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 30, 4000, 3200, 4800, 71.2, 'rising'),
  ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 60, 8000, 6400, 9600, 65.8, 'rising'),
  ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 90, 12000, 9600, 14400, 60.4, 'rising')
ON CONFLICT (product_id, warehouse_id, days_ahead) DO UPDATE SET
  predicted_qty = EXCLUDED.predicted_qty,
  confidence_lower = EXCLUDED.confidence_lower,
  confidence_upper = EXCLUDED.confidence_upper,
  confidence_score = EXCLUDED.confidence_score,
  trend = EXCLUDED.trend,
  forecast_date = CURRENT_DATE;

-- ============================================================
-- SECTION 7: LIQUIDATION RECOMMENDATIONS
-- ============================================================

INSERT INTO liquidation_recommendations (product_id, warehouse_id, current_qty, days_to_expiry, recommended_action, discount_pct, urgency_level, estimated_revenue_loss)
VALUES
  ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 2000, NULL, 'bundle_promotion', 15.00, 'low', 600.00),
  ('c1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003', 0, NULL, 'return_to_supplier', 10.00, 'high', 0.00),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 60, NULL, 'transfer_to_hub', 10.00, 'medium', 150.00),
  ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 40, 8, 'liquidate_discount', 30.00, 'high', 480.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 8: CYCLE COUNTS
-- ============================================================

-- Completed cycle count with discrepancies
INSERT INTO cycle_counts (id, warehouse_id, status, scheduled_date, completed_date, started_at, created_by, notes, count_type)
VALUES (
  'e1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'completed',
  CURRENT_DATE - 5,
  CURRENT_DATE - 4,
  CURRENT_DATE - 5,
  'admin@warehouse.com',
  'Zone A weekly spot check',
  'zone-based'
);

INSERT INTO cycle_count_items (id, cycle_count_id, product_id, warehouse_id, expected_qty, actual_qty, variance, variance_pct, discrepancy_flag, status, counted_by, counted_at)
VALUES
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 450, 430, -20, -4.44, true, 'verified', 'counter1@warehouse.com', CURRENT_DATE - 4),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 220, 220, 0, 0.00, false, 'verified', 'counter1@warehouse.com', CURRENT_DATE - 4),
  ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 35, 28, -7, -20.00, true, 'verified', 'counter2@warehouse.com', CURRENT_DATE - 4),
  ('e2000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 18, 25, 7, 38.89, true, 'verified', 'counter2@warehouse.com', CURRENT_DATE - 4),
  ('e2000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 580, 580, 0, 0.00, false, 'verified', 'counter1@warehouse.com', CURRENT_DATE - 4)
ON CONFLICT (cycle_count_id, product_id) DO NOTHING;

INSERT INTO inventory_discrepancies (id, product_id, warehouse_id, cycle_count_id, expected_qty, actual_qty, variance, variance_pct, root_cause, resolved)
VALUES
  ('e3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 450, 430, -20, -4.44, 'shrinkage', true),
  ('e3000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 35, 28, -7, -20.00, 'damage', false),
  ('e3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 18, 25, 7, 38.89, 'data_entry_error', true)
ON CONFLICT DO NOTHING;

-- In-progress cycle count
INSERT INTO cycle_counts (id, warehouse_id, status, scheduled_date, started_at, created_by, notes, count_type)
VALUES (
  'e1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'in-progress',
  CURRENT_DATE,
  NOW(),
  'admin@warehouse.com',
  'Cold storage monthly count',
  'full'
);

INSERT INTO cycle_count_items (id, cycle_count_id, product_id, warehouse_id, expected_qty, actual_qty, variance, variance_pct, discrepancy_flag, status)
VALUES
  ('e2000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 3000, NULL, NULL, NULL, false, 'pending'),
  ('e2000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 100, NULL, NULL, NULL, false, 'pending'),
  ('e2000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 25, NULL, NULL, NULL, false, 'pending'),
  ('e2000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 550, 545, -5, -0.91, true, 'counted'),
  ('e2000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 110, 108, -2, -1.82, true, 'counted')
ON CONFLICT (cycle_count_id, product_id) DO NOTHING;

-- ============================================================
-- SECTION 9: TRANSFERS
-- ============================================================

-- Completed transfer
INSERT INTO transfers (id, from_warehouse_id, to_warehouse_id, status, created_by, approved_by, shipped_by, received_by, initiated_date, approved_date, shipped_date, received_date, notes, transfer_reason)
VALUES (
  'f1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000003',
  'received',
  'ops@warehouse.com',
  'manager@warehouse.com',
  'driver@warehouse.com',
  'receiver@warehouse.com',
  CURRENT_DATE - 10,
  CURRENT_DATE - 9,
  CURRENT_DATE - 8,
  CURRENT_DATE - 6,
  'Rebalancing stock for seasonal demand',
  'rebalance'
);

INSERT INTO transfer_items (id, transfer_id, product_id, requested_qty, shipped_qty, received_qty, variance, variance_pct, status)
VALUES
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 200, 200, 200, 0, 0.00, 'received'),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 100, 100, 98, -2, -2.00, 'received'),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 150, 150, 150, 0, 0.00, 'received')
ON CONFLICT (transfer_id, product_id) DO NOTHING;

INSERT INTO transfer_audit_log (transfer_id, action, performed_by, details)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'created', 'ops@warehouse.com', '{"items": 3}'),
  ('f1000000-0000-0000-0000-000000000001', 'approved', 'manager@warehouse.com', '{}'),
  ('f1000000-0000-0000-0000-000000000001', 'shipped', 'driver@warehouse.com', '{"carrier": "Self"}'),
  ('f1000000-0000-0000-0000-000000000001', 'received', 'receiver@warehouse.com', '{}')
ON CONFLICT DO NOTHING;

-- In-transit transfer
INSERT INTO transfers (id, from_warehouse_id, to_warehouse_id, status, created_by, approved_by, shipped_by, initiated_date, approved_date, shipped_date, notes, transfer_reason)
VALUES (
  'f1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001',
  'in-transit',
  'ops@warehouse.com',
  'manager@warehouse.com',
  'driver@warehouse.com',
  CURRENT_DATE - 3,
  CURRENT_DATE - 2,
  CURRENT_DATE - 1,
  'Moving expiry-risk items to main warehouse for clearance',
  'demand_shift'
);

INSERT INTO transfer_items (id, transfer_id, product_id, requested_qty, shipped_qty, status)
VALUES
  ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000010', 30, 30, 'shipped'),
  ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000007', 20, 20, 'shipped')
ON CONFLICT (transfer_id, product_id) DO NOTHING;

-- Draft transfer (pending approval)
INSERT INTO transfers (id, from_warehouse_id, to_warehouse_id, status, created_by, initiated_date, notes, transfer_reason)
VALUES (
  'f1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'draft',
  'ops@warehouse.com',
  CURRENT_DATE,
  'Dead stock redistribution - to be approved',
  'dead_stock_redistribution'
);

INSERT INTO transfer_items (id, transfer_id, product_id, requested_qty, status)
VALUES
  ('f2000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000016', 30, 'pending')
ON CONFLICT (transfer_id, product_id) DO NOTHING;

-- ============================================================
-- SECTION 10: PICK BATCHES
-- ============================================================

-- Completed pick batch
INSERT INTO pick_batches (id, warehouse_id, status, created_date, completed_date, started_at, picker_id, total_items, total_picks_completed, efficiency_score, notes)
VALUES (
  '71000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'completed',
  CURRENT_DATE - 2,
  CURRENT_DATE - 2,
  CURRENT_DATE - 2,
  'a2000000-0000-0000-0000-000000000001',
  8,
  8,
  92.50,
  'Morning batch - Zone A & B'
);

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, picked_qty, status, sequence_order, picked_by, picked_at)
SELECT 
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  b.id,
  50, 50, 'verified', 1,
  'a2000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 2
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000001' AND b.zone = 'A' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, picked_qty, status, sequence_order, picked_by, picked_at)
SELECT 
  '72000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  b.id,
  25, 25, 'verified', 2,
  'a2000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 2
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000001' AND b.zone = 'A' AND b.product_id = 'c1000000-0000-0000-0000-000000000002' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

-- In-progress pick batch
INSERT INTO pick_batches (id, warehouse_id, status, created_date, started_at, picker_id, total_items, notes)
VALUES (
  '71000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'in-progress',
  CURRENT_DATE,
  NOW(),
  'a2000000-0000-0000-0000-000000000002',
  6,
  'Urgent pharma orders - cold storage'
);

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, picked_qty, status, sequence_order)
SELECT 
  '72000000-0000-0000-0000-000000000003',
  '71000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000008',
  b.id,
  200, 200, 'picked', 1
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000002' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, picked_qty, status, sequence_order)
SELECT 
  '72000000-0000-0000-0000-000000000004',
  '71000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000009',
  b.id,
  30, 30, 'picked', 2
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000002' AND b.product_id = 'c1000000-0000-0000-0000-000000000009' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, status, sequence_order)
SELECT 
  '72000000-0000-0000-0000-000000000005',
  '71000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000011',
  b.id,
  50, 'pending', 3
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000002' AND b.product_id = 'c1000000-0000-0000-0000-000000000011' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

-- Draft pick batch
INSERT INTO pick_batches (id, warehouse_id, status, created_date, total_items, notes)
VALUES (
  '71000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'draft',
  CURRENT_DATE,
  5,
  'Afternoon batch - Zone B & C'
);

INSERT INTO pick_batch_items (id, pick_batch_id, product_id, location_id, requested_qty, status, sequence_order)
SELECT 
  '72000000-0000-0000-0000-000000000006',
  '71000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000018',
  b.id,
  10, 'pending', 1
FROM bin_locations b WHERE b.warehouse_id = 'a1000000-0000-0000-0000-000000000001' AND b.product_id = 'c1000000-0000-0000-0000-000000000018' LIMIT 1
ON CONFLICT (pick_batch_id, product_id) DO NOTHING;

-- ============================================================
-- SECTION 11: UPDATE PRODUCT ANALYTICS
-- ============================================================

UPDATE product_analytics SET
  avg_daily_demand = 45.0,
  days_to_stockout = 18.9,
  expiry_risk_score = 5,
  health_score = 72,
  health_label = 'At Risk',
  classification = 'Fast Moving',
  demand_trend = 'rising'
WHERE product_id = 'c1000000-0000-0000-0000-000000000001';

UPDATE product_analytics SET
  avg_daily_demand = 15.0,
  days_to_stockout = 21.3,
  expiry_risk_score = 75,
  health_score = 35,
  health_label = 'Critical',
  classification = 'Expiry Risk',
  demand_trend = 'falling'
WHERE product_id = 'c1000000-0000-0000-0000-000000000007';

UPDATE product_analytics SET
  avg_daily_demand = 0.8,
  days_to_stockout = NULL,
  expiry_risk_score = 0,
  health_score = 42,
  health_label = 'At Risk',
  classification = 'Dead Stock',
  demand_trend = 'falling'
WHERE product_id = 'c1000000-0000-0000-0000-000000000016';

UPDATE product_analytics SET
  avg_daily_demand = 25.0,
  days_to_stockout = 0.2,
  expiry_risk_score = 0,
  health_score = 12,
  health_label = 'Critical',
  classification = 'Fast Moving',
  demand_trend = 'rising'
WHERE product_id = 'c1000000-0000-0000-0000-000000000017';

-- ============================================================
-- SECTION 12: FINAL VERIFICATION
-- ============================================================

-- Log completion
INSERT INTO sync_logs (source, status, records_synced, synced_at, error_message)
VALUES ('warehouse_data.sql', 'success', 150, NOW(), NULL);

-- Output summary (run as SELECT to verify)
-- SELECT 
--   'Warehouses' as table_name, COUNT(*) as record_count FROM warehouses
-- UNION ALL SELECT 'Products', COUNT(*) FROM products
-- UNION ALL SELECT 'Inventory', COUNT(*) FROM inventory
-- UNION ALL SELECT 'Bin Locations', COUNT(*) FROM bin_locations
-- UNION ALL SELECT 'Stock Movements', COUNT(*) FROM stock_movements
-- UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers
-- UNION ALL SELECT 'Supplier Orders', COUNT(*) FROM supplier_orders
-- UNION ALL SELECT 'Supplier Performance', COUNT(*) FROM supplier_performance
-- UNION ALL SELECT 'Demand Forecasts', COUNT(*) FROM demand_forecast
-- UNION ALL SELECT 'Cycle Counts', COUNT(*) FROM cycle_counts
-- UNION ALL SELECT 'Transfers', COUNT(*) FROM transfers
-- UNION ALL SELECT 'Pick Batches', COUNT(*) FROM pick_batches
-- UNION ALL SELECT 'Alerts', COUNT(*) FROM alerts
-- UNION ALL SELECT 'Liquidation Recommendations', COUNT(*) FROM liquidation_recommendations;
