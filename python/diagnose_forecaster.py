"""
Targeted diagnostic: check what actually exists in stock_movements for the forecaster product.
Run from: python/ directory with .env.local loaded
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET_PRODUCT = "c1000000-0000-0000-0000-000000000003"
WAREHOUSE_ID   = "a1000000-0000-0000-0000-000000000001"

print("=" * 60)
print("DEMAND FORECASTER DIAGNOSTIC")
print("=" * 60)

# 1. Check product exists in products table
prod = supabase.table("products").select("id,name").eq("id", TARGET_PRODUCT).execute()
if prod.data:
    print(f"[OK] Product exists: {prod.data[0]['name']}")
else:
    print(f"[FAIL] Product {TARGET_PRODUCT} NOT FOUND in products table")
    print("       --> Run reset_and_seed_high_fidelity.py first")
    sys.exit(1)

# 2. Check raw count in stock_movements for this product
rows = supabase.table("stock_movements")\
    .select("date,quantity,type", count="exact")\
    .eq("product_id", TARGET_PRODUCT)\
    .execute()

count = rows.count if hasattr(rows, 'count') else len(rows.data)
print(f"[INFO] stock_movements rows for product ...0003: {count}")

if count == 0:
    print("[FAIL] Zero rows - seed did not persist, likely FK violation on insert")
    # Let's probe FK constraints
    probe = supabase.table("stock_movements")\
        .select("product_id")\
        .limit(5)\
        .execute()
    if probe.data:
        print(f"[INFO] Sample product_ids in stock_movements table:")
        for r in probe.data:
            print(f"       {r['product_id']}")
    else:
        print("[WARN] stock_movements table is completely empty")
else:
    print(f"[OK] {count} rows found")

# 3. Check date range
if rows.data:
    dates = [r['date'] for r in rows.data if r.get('date')]
    if dates:
        dates.sort()
        print(f"[INFO] Oldest date:  {dates[0]}")
        print(f"[INFO] Newest date:  {dates[-1]}")
        from datetime import datetime
        oldest = datetime.strptime(dates[0][:10], "%Y-%m-%d")
        newest = datetime.strptime(dates[-1][:10], "%Y-%m-%d")
        span = (newest - oldest).days
        print(f"[INFO] Date span: {span} days (need >= 14)")
        if span >= 14:
            print("[OK] Sufficient history for forecasting")
        else:
            print("[FAIL] Insufficient history - date span too short")

# 4. Check if warehouse_id FK is valid
wh = supabase.table("warehouses").select("id,name").eq("id", WAREHOUSE_ID).execute()
if wh.data:
    print(f"[OK] Warehouse exists: {wh.data[0]['name']}")
else:
    print(f"[WARN] Warehouse {WAREHOUSE_ID} not found - stock_movements FK may be failing")

# 5. Attempt a direct insert probe (dry run with 1 row, then delete it)
print("\n[PROBE] Testing direct insert into stock_movements...")
try:
    test_row = {
        "product_id": TARGET_PRODUCT,
        "type": "out",
        "quantity": 1,
        "warehouse_id": WAREHOUSE_ID,
        "date": "2025-01-01",
    }
    res = supabase.table("stock_movements").insert(test_row).execute()
    if res.data:
        inserted_id = res.data[0].get("id")
        print(f"[OK] Insert succeeded (id={inserted_id})")
        # Clean up the probe row
        if inserted_id:
            supabase.table("stock_movements").delete().eq("id", inserted_id).execute()
            print("[OK] Probe row cleaned up")
    else:
        print(f"[FAIL] Insert returned no data: {res}")
except Exception as e:
    print(f"[FAIL] Insert probe failed with exception: {e}")
    import traceback
    traceback.print_exc()

print("=" * 60)
print("Run: python demand_forecaster.py c1000000-0000-0000-0000-000000000003")
print("=" * 60)
