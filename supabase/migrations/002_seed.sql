-- ============================================================
-- 002_seed.sql — Reference / config seed data
-- Run AFTER 001_schema.sql
-- ============================================================

-- WAREHOUSES
INSERT INTO warehouses (id, name, location, capacity) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Main Warehouse', 'Mumbai, MH', 50000),
  ('a1000000-0000-0000-0000-000000000002', 'Cold Storage Unit', 'Pune, MH', 20000),
  ('a1000000-0000-0000-0000-000000000003', 'Distribution Hub', 'Nashik, MH', 35000)
ON CONFLICT (id) DO NOTHING;

-- SUPPLIERS
INSERT INTO suppliers (id, name, contact, avg_lead_time_days) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Reliance Supply Co.',   'reliance@supply.in',  5),
  ('b1000000-0000-0000-0000-000000000002', 'Pharma Direct Ltd.',    'orders@pharmadirect.in', 3),
  ('b1000000-0000-0000-0000-000000000003', 'TechParts India Pvt.',  'sales@techparts.in', 10)
ON CONFLICT (id) DO NOTHING;
