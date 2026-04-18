import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

PRODUCT_ID = "c1000000-0000-0000-0000-000000000007"
BASELINE = -30
WEEKLY_WEIGHTS = {0: 2.0, 1: 1.8, 2: 1.2, 3: 1.0, 4: 1.1, 5: 0.6, 6: 0.4}
SIGMA = 5.0
TREND_WEEKLY_GROWTH = 0.005

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("[Regen] Purging existing records for product:", PRODUCT_ID)
delete_resp = supabase.table("stock_movements").delete().eq("product_id", PRODUCT_ID).execute()
print(f"[Regen] Deleted {len(delete_resp.data) if hasattr(delete_resp, 'data') else 'N/A'} records")

print("[Regen] Generating 365 days of high-entropy stochastic data...")

start_date = datetime(2025, 4, 14)
dates = pd.date_range(start=start_date, periods=365, freq="D")

np.random.seed(42)

records = []
for i, date in enumerate(dates):
    week_num = i // 7
    trend_factor = 1 + (week_num * TREND_WEEKLY_GROWTH)
    
    day_of_week = date.weekday()
    weekly_weight = WEEKLY_WEIGHTS[day_of_week]
    
    base_value = BASELINE * weekly_weight * trend_factor
    
    noise = np.random.normal(0, SIGMA)
    
    qty = round(base_value + noise, 2)
    
    if qty > 0:
        trans_type = "in"
        qty = abs(qty)
    else:
        trans_type = "out"
        qty = abs(qty)
    
    if i % 90 in [15, 50, 75]:
        qty = qty * 5
        print(f"[Regen] Black Swan event injected: {date.date()} (5x spike)")
    
    records.append({
        "product_id": PRODUCT_ID,
        "type": trans_type,
        "quantity": qty,
        "date": date.strftime("%Y-%m-%d"),
    })

print(f"[Regen] Generated {len(records)} records")

print("[Regen] Batch inserting into Supabase...")
batch_size = 50
for i in range(0, len(records), batch_size):
    batch = records[i:i+batch_size]
    resp = supabase.table("stock_movements").insert(batch).execute()
    print(f"[Regen] Inserted batch {i//batch_size + 1}/{(len(records)+batch_size-1)//batch_size}")

print("[Regen] Regeneration complete")

print("\n" + "="*50)
print("Re-running Statistical Fidelity Audit...")
print("="*50 + "\n")

result = supabase.table("stock_movements").select(
    "date", "quantity", "type"
).eq("product_id", PRODUCT_ID).order("date").execute()

df = pd.DataFrame(result.data)
df["date"] = pd.to_datetime(df["date"])
df["day_of_week"] = df["date"].dt.dayofweek

print(f"[Audit] Total records: {len(df)}")

daily_vol = df.groupby("date").agg(
    total_qty=("quantity", "sum")
).reset_index()

daily_vol["date"] = pd.to_datetime(daily_vol["date"])
daily_vol = daily_vol.set_index("date").resample("D").sum().fillna(0).reset_index()

mean_daily = daily_vol["total_qty"].mean()
std_daily = daily_vol["total_qty"].std()
cv = std_daily / abs(mean_daily) if mean_daily != 0 else float('inf')

print(f"\n=== Statistical Signature ===")
print(f"Date range: {daily_vol['date'].min().date()} to {daily_vol['date'].max().date()}")
print(f"Days in dataset: {len(daily_vol)}")
print(f"Average Daily Volume (Mean): {mean_daily:.2f}")
print(f"Standard Deviation: {std_daily:.2f}")
print(f"Coefficient of Variation (CV): {cv:.4f}")

if cv < 0.1:
    print(f"\n[FLAG] Too Low Variance (CV < 0.1)")
else:
    print(f"\n[OK] Variance acceptable")

weekly_dist = df.groupby("day_of_week").agg(
    avg_qty=("quantity", "mean")
).reset_index()

day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
weekly_dist["day_name"] = weekly_dist["day_of_week"].map(lambda x: day_names[x])

print(f"\n=== Weekly Distribution ===")
for _, row in weekly_dist.iterrows():
    print(f"  {row['day_name']}: {row['avg_qty']:.2f}")

weekday_avg = weekly_dist[weekly_dist["day_of_week"] < 5]["avg_qty"].mean()
weekend_avg = weekly_dist[weekly_dist["day_of_week"] >= 5]["avg_qty"].mean()

print(f"\n  Weekday avg: {weekday_avg:.2f}")
print(f"  Weekend avg: {weekend_avg:.2f}")

delta_pct = abs(weekday_avg - weekend_avg) / max(weekday_avg, weekend_avg) * 100

print(f"  Delta: {delta_pct:.1f}%")

if delta_pct > 40:
    print(f"\n[OK] Weekday/Weekend delta > 40%")
else:
    print(f"\n[FLAG] Low Fidelity (delta < 40%)")

unique_daily = daily_vol["total_qty"].nunique()
print(f"\n=== Entropy Check ===")
print(f"Unique daily values: {unique_daily}")
print(f"Total days: {len(daily_vol)}")

if unique_daily < len(daily_vol) * 0.5:
    print(f"[FLAG] Low Entropy - data may be repeating")
else:
    print(f"[OK] Good entropy")

print(f"\n=== Summary ===")
fidelity_ok = cv >= 0.1 and unique_daily >= 300 and delta_pct > 40
if fidelity_ok:
    print("Dataset PASSED Statistical Fidelity Audit")
else:
    print("Dataset FAILED Statistical Fidelity Audit")
    if unique_daily < 300:
        print(f"  -> Need Entropy > 300 (currently {unique_daily})")
    if delta_pct <= 40:
        print(f"  -> Need Weekday/Weekend Delta > 40% (currently {delta_pct:.1f}%)")