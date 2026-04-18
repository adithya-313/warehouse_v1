import os
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

PRODUCT_ID = "c1000000-0000-0000-0000-000000000007"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"[Audit] Fetching inventory_transactions for product: {PRODUCT_ID}")
result = supabase.table("stock_movements").select(
    "date", "quantity", "type"
).eq("product_id", PRODUCT_ID).order("date").execute()

if not result.data:
    print("[Error] No data found for this product")
    exit(1)

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

if weekday_avg == 0 or weekend_avg == 0:
    print(f"\n[FLAG] Low Fidelity (flat distribution)")
elif abs(weekday_avg - weekend_avg) / max(weekday_avg, weekend_avg) < 0.1:
    print(f"\n[FLAG] Low Fidelity (no weekday/weekend distinction)")
else:
    print(f"\n[OK] Weekly pattern detected")

unique_daily = daily_vol["total_qty"].nunique()
print(f"\n=== Entropy Check ===")
print(f"Unique daily values: {unique_daily}")
print(f"Total days: {len(daily_vol)}")

if unique_daily < len(daily_vol) * 0.5:
    print(f"[FLAG] Low Entropy - data may be repeating")
else:
    print(f"[OK] Good entropy")

print(f"\n=== Summary ===")
fidelity_ok = cv >= 0.1 and unique_daily >= len(daily_vol) * 0.5 and abs(weekday_avg - weekend_avg) / max(weekday_avg, weekend_avg) >= 0.1
if fidelity_ok:
    print("Dataset PASSED Statistical Fidelity Audit")
else:
    print("Dataset FAILED Statistical Fidelity Audit")