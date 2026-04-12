# Warehouse MVP Demo Guide

Complete walkthrough for testing all features of the Warehouse Management System.

## Quick Start

### 1. Load Test Data

Run the migrations and seed data in Supabase SQL Editor:

```sql
-- Run in order:
-- 001_schema.sql (base tables)
-- 002_seed.sql (warehouses, suppliers)
-- 003_seed_data.sql (products, inventory, movements)
-- 004_cycle_counts.sql (cycle counting tables)
-- 005_transfers.sql (transfer tables)
-- 006_picking.sql (picking tables)
-- 007_forecasting.sql (demand forecasting tables)
-- 008_suppliers.sql (supplier performance tables)
-- 009_warehouse_data.sql (comprehensive test data)
```

Or copy the SQL from `supabase/migrations/009_warehouse_data.sql` directly into Supabase SQL Editor.

### 2. Start the Application

```bash
cd warehouse_v1
npm install
npm run dev
```

Open http://localhost:3000

---

## Test Data Overview

### Warehouses
| ID | Name | Location | Purpose |
|----|------|---------|---------|
| a1000000-0000-0000-0000-000000000001 | Main Warehouse | Mumbai, MH | Primary storage |
| a1000000-0000-0000-0000-000000000002 | Cold Storage Unit | Pune, MH | Pharma products |
| a1000000-0000-0000-0000-000000000003 | Distribution Hub | Nashik, MH | Fulfillment |

### Products
| Category | Products | Stock Status |
|----------|----------|--------------|
| FMCG | Rice, Oil, Flour, Dal, Water | Various (some critical) |
| Pharma | Paracetamol, Amoxicillin, Cough Syrup | Some at expiry risk |
| Electronics | Cables, Batteries, Mouse, Lamps | Some dead stock |

### Suppliers
| Supplier | Performance | Notes |
|----------|-------------|-------|
| Pharma Direct Ltd. | 75% on-time, 100% quality | Primary pharma supplier |
| TechParts India | 50% on-time, 75% quality | Electronics supplier |
| Budget Supplies Co. | 0% on-time, 50% quality | Low performer |
| Reliance Supply Co. | 100% on-time | Primary FMCG |

---

## Workflow 1: Dashboard Overview

**Objective:** See real-time warehouse health

**Steps:**
1. Navigate to `/dashboard`
2. Observe the metric cards:
   - **Total Products:** 20
   - **Critical Alerts:** Red badge showing count
   - **Avg Health Score:** Overall warehouse health
   - **Warehouses:** 3 locations
3. Scroll down to see product table
4. Notice color-coded rows:
   - **Red border:** Critical health
   - **Yellow indicator:** Low stock
5. Filter by category or classification
6. Search for specific products

**Screenshot Points:**
- [ ] Metric cards at top
- [ ] Product table with health indicators
- [ ] Filter controls

---

## Workflow 2: Cycle Counting

**Objective:** Verify inventory accuracy through physical counts

### Part A: Complete Existing Count

1. Navigate to `/cycle-counts`
2. You should see "Cold Storage Monthly Count" with status **In Progress**
3. Click on the count to view details
4. Notice 5 products listed:
   - 3 pending (no actual qty)
   - 2 counted (with variance)
5. Count remaining items:
   - Enter actual quantities
   - System auto-calculates variance
6. Click **Finalize Count**
7. View the discrepancies dashboard

### Part B: Create New Count

1. Navigate to `/cycle-counts`
2. Click **New Cycle Count**
3. Select **Main Warehouse**
4. Choose count type: **Zone-based** or **Full**
5. Add notes: "Weekly spot check"
6. Submit
7. Start counting:
   - Basmati Rice: Expected 430, Count 425 (-5 units)
   - Wheat Flour: Expected 30, Count 28 (-2 units, >5% variance flagged)
   - Water: Expected 15, Count 25 (+10 units, overage flagged)
8. Submit counts as you go
9. **Finalize** the count
10. View discrepancy report

**Expected Results:**
- Variance >5% flagged in red
- Root causes: shrinkage, damage, data entry error
- Adjust inventory automatically

**Screenshot Points:**
- [ ] New cycle count form
- [ ] Count items with variance calculations
- [ ] Discrepancy report

---

## Workflow 3: Multi-Location Transfers

**Objective:** Move stock between warehouses

### Part A: Approve Draft Transfer

1. Navigate to `/transfers`
2. Find "Dead stock redistribution" (Status: Draft)
3. Click **View**
4. Review items:
   - HDMI Cable: 30 units from Distribution Hub
5. Click **Approve**
6. Status changes to **Approved**
7. Click **Ship**
8. Add shipping notes
9. Click **Mark Shipped**
10. Status changes to **In Transit**

### Part B: Receive Transfer

1. Navigate to `/transfers`
2. Find "Expiry-risk items transfer" (Status: In Transit)
3. Click **Receive**
4. Review items:
   - Cough Syrup: 30 units
   - Butter: 20 units
5. Enter received quantities (some may have variance)
6. Click **Confirm Receipt**
7. Verify inventory updated in Main Warehouse

### Part C: Create New Transfer

1. Navigate to `/transfers`
2. Click **New Transfer**
3. From: **Main Warehouse**
4. To: **Cold Storage Unit**
5. Reason: **Demand Shift**
6. Add items:
   - Paracetamol 500mg: 500 strips
   - Vitamin C Tablets: 200 strips
7. Submit
8. Approve → Ship → Receive flow

**Expected Results:**
- Stock reserved on approval
- Stock deducted on ship
- Stock credited on receive
- Audit trail maintained

**Screenshot Points:**
- [ ] Transfer list with statuses
- [ ] Transfer detail with items
- [ ] Status timeline

---

## Workflow 4: Picking Optimization

**Objective:** Efficient order fulfillment with zone routing

### Part A: View Active Pick Batch

1. Navigate to `/picking`
2. Find "Urgent pharma orders" (Status: In Progress)
3. Click to view
4. Notice **sequence optimization:**
   - Products ordered by zone (A → B → C)
   - Minimizes walking distance
5. Pick items:
   - Scan barcode or enter manually
   - Mark each item as picked
6. Complete batch
7. View efficiency score

### Part B: Create New Pick Batch

1. Navigate to `/picking`
2. Click **Create Batch**
3. Select **Main Warehouse**
4. Add items:
   - USB-C Cable: 5 units
   - LED Desk Lamp: 3 units
   - AA Batteries: 50 units
5. Submit
6. Assign to picker (optional)
7. Start picking:
   - Zone A: USB-C Cable
   - Zone B: LED Desk Lamp
   - Zone C: Batteries
8. Complete batch
9. Check efficiency score (target: >85%)

### Part C: Picker Performance

1. Navigate to `/picking/performance`
2. View metrics:
   - Total batches completed
   - Average efficiency
   - Accuracy rate

**Expected Results:**
- Zone-based sequence optimization
- Efficiency tracking
- Pick audit trail

**Screenshot Points:**
- [ ] Pick batch with sequence
- [ ] Active picking interface
- [ ] Performance metrics

---

## Workflow 5: Demand Forecasting

**Objective:** Predict future demand and identify overstock

### Part A: View Forecasts

1. Navigate to `/forecasting`
2. Select **Main Warehouse**
3. Click **Generate Forecasts** (if none exist)
4. Switch to **Demand Forecast** tab
5. View table:
   - Product names
   - Trend indicators (Rising/Stable/Falling)
   - 30/60/90-day predictions
   - Confidence scores
6. Click **Trends →** on Basmati Rice

### Part B: Demand Trends Analysis

1. View chart:
   - **Cyan line:** Historical demand (last 30 days)
   - **Amber area:** Forecast with confidence bands
2. Toggle between 30/60/90 day views
3. Observe trend indicator

### Part C: Overstock Analysis

1. Switch to **Overstock** tab
2. View products ranked by:
   - Capital tied up
   - Days of supply
   - Recommended discount
3. AA Batteries shows:
   - High urgency (excess stock)
   - 15% discount recommended

**Screenshot Points:**
- [ ] Forecast summary cards
- [ ] Demand forecast table
- [ ] Trend chart
- [ ] Overstock analysis

---

## Workflow 6: Liquidation Recommendations

**Objective:** Clear excess inventory before it expires

1. Navigate to `/liquidation-recommendations`
2. View items grouped by urgency:
   - **High:** Butter 500g (expires in 8 days, 30% discount)
   - **Medium:** Wheat Flour (days supply >90)
   - **Low:** AA Batteries (days supply >60)
3. For each item:
   - Review recommendation
   - See estimated revenue loss
4. Click **Approve** on Butter
5. Item moves to acknowledged list

**Screenshot Points:**
- [ ] Urgency-grouped recommendations
- [ ] Action buttons
- [ ] Discount percentages

---

## Workflow 7: Supplier Performance

**Objective:** Monitor and evaluate supplier reliability

### Part A: Supplier List

1. Navigate to `/suppliers`
2. View all suppliers with metrics:
   - Rating (1-5 stars)
   - On-time % (green/yellow/red)
   - Quality score
   - Reliability score
3. Notice Budget Supplies Co. highlighted:
   - Reliability: 30 (RED - <60)
   - Low performer alert

### Part B: Supplier Detail

1. Click on **Budget Supplies Co.**
2. View alert banner: "Low Performance Alert"
3. Switch to **Metrics** tab
4. View chart: On-time delivery trend
5. Switch to **Orders** tab
6. View order history:
   - Late deliveries flagged
   - Quality issues marked

### Part C: Create New Order

1. Navigate to `/supplier-orders`
2. Click **New Order**
3. Select Supplier: **Pharma Direct Ltd.**
4. Select Product: **Paracetamol 500mg**
5. Order Date: Today
6. Expected Delivery: +5 days
7. Quantity: 1000
8. Unit Cost: 0.50
9. Submit

### Part D: Receive Order

1. Navigate to `/supplier-orders`
2. Click **Receive Order**
3. Search for order (by ID or list pending)
4. Enter:
   - Actual Delivery: Today
   - Received Qty: 1000
   - Quality Issues: No
5. Submit
6. Check supplier performance updated

**Screenshot Points:**
- [ ] Supplier list with metrics
- [ ] Performance detail page
- [ ] Low performer alert
- [ ] Order receipt form

---

## Workflow 8: Alerts & Notifications

**Objective:** Stay on top of critical issues

1. Navigate to `/alerts`
2. View alerts grouped by severity:
   - **Critical:** Stockout warnings (Water, Mouse)
   - **Critical:** Expiry warnings (Butter, Cough Syrup)
   - **Warning:** Reorder needed (Flour, Amoxicillin)
   - **Info:** Dead stock (HDMI Cable, Laptop Stand)
3. Click alert to view details
4. See recommended action
5. Click **Resolve** to dismiss

**Screenshot Points:**
- [ ] Alert severity badges
- [ ] Recommended actions
- [ ] Resolve button

---

## Edge Cases to Test

### 1. Stockout Scenario
- **Product:** Packaged Drinking Water
- **Situation:** <1 day supply remaining
- **Expected:** Critical alert, immediate reorder recommendation

### 2. Expiry Risk
- **Product:** Butter 500g
- **Situation:** Expires in 6 days
- **Expected:** High urgency liquidation recommendation

### 3. Dead Stock
- **Product:** HDMI Cable 2m
- **Situation:** No movement in 90+ days
- **Expected:** Dead stock alert, return to supplier recommendation

### 4. Low Performer Supplier
- **Supplier:** Budget Supplies Co.
- **Situation:** 0% on-time, 50% quality
- **Expected:** Reliability <60, warning in supplier detail

### 5. Overstock
- **Product:** AA Batteries 8pk
- **Situation:** 2000 units, 120+ days supply
- **Expected:** Low urgency liquidation, 15% discount

---

## Feature Status Checklist

### Core Features
- [x] Dashboard with health metrics
- [x] Product management
- [x] Inventory tracking
- [x] Stock movements
- [x] Alerts system

### Operations
- [x] Cycle counting with variance
- [x] Multi-location transfers
- [x] Pick batch management
- [x] Zone-based routing

### Analytics
- [x] Demand forecasting (30/60/90 days)
- [x] Overstock detection
- [x] Liquidation recommendations
- [x] Supplier performance metrics

### Supplier Management
- [x] Supplier CRUD
- [x] Order management
- [x] Receipt processing
- [x] Performance tracking

---

## API Testing

### Test Demand Forecast Generation
```bash
# Get warehouse ID
curl http://localhost:3000/api/warehouses

# Generate forecasts
curl -X POST http://localhost:3000/api/demand-forecast \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id": "a1000000-0000-0000-0000-000000000001"}'

# Get forecasts
curl "http://localhost:3000/api/demand-forecast?warehouse_id=a1000000-0000-0000-0000-000000000001"
```

### Test Supplier Performance
```bash
# Get suppliers
curl http://localhost:3000/api/suppliers

# Get low performers
curl http://localhost:3000/api/supplier-performance/low-performers

# Create order
curl -X POST http://localhost:3000/api/supplier-orders \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "b1000000-0000-0000-0000-000000000002",
    "product_id": "c1000000-0000-0000-0000-000000000008",
    "order_date": "2026-04-12",
    "expected_delivery": "2026-04-17",
    "ordered_qty": 100,
    "unit_cost": 0.50
  }'
```

---

## Troubleshooting

### Empty Data Issues
If pages show "No data available":
1. Run `009_warehouse_data.sql` in Supabase
2. Restart the Next.js server
3. Refresh the page

### API Errors
Check browser console (F12) and server logs for:
- Missing environment variables
- Database connection issues
- Query errors

### Missing Features
If links don't work, verify navigation in `Sidebar.tsx`

---

## Summary

This demo covers the complete warehouse management workflow:
- **Real-time monitoring** via dashboard
- **Accuracy** via cycle counting
- **Efficiency** via transfers and picking
- **Intelligence** via demand forecasting
- **Performance** via supplier management
- **Proactivity** via alerts system

All features are interconnected - supplier performance affects inventory, forecasting informs purchasing, and cycle counts maintain accuracy.
