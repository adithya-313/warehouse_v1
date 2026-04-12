"""
supplier_performance.py — Supplier Performance Metrics Engine
Aggregates supplier_orders to calculate performance metrics.
"""

import os
import logging
from datetime import date, timedelta
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [SUPPLIER] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

LOOKBACK_DAYS = 30
RELIABILITY_THRESHOLD = 60


def calculate_supplier_performance(supplier_id: str) -> dict:
    cutoff = str(date.today() - timedelta(days=LOOKBACK_DAYS))

    orders = (
        supabase.table("supplier_orders")
        .select("*")
        .eq("supplier_id", supplier_id)
        .eq("status", "received")
        .gte("order_date", cutoff)
        .execute()
        .data
    )

    if not orders:
        return {
            "supplier_id": supplier_id,
            "on_time_delivery_pct": 0,
            "quality_score": 100,
            "avg_lead_time_days": 0,
            "last_30_days_orders": 0,
            "total_cost_30_days": 0,
            "reliability_score": 0,
        }

    total_orders = len(orders)
    on_time_count = sum(1 for o in orders if o.get("on_time"))
    on_time_delivery_pct = (on_time_count / total_orders) * 100

    quality_issues_count = sum(1 for o in orders if o.get("quality_issues"))
    quality_score = max(0, min(100, 100 - quality_issues_count * 10))

    lead_times = []
    total_cost = 0
    for order in orders:
        if order.get("actual_delivery") and order.get("order_date"):
            actual = date.fromisoformat(order["actual_delivery"])
            ordered = date.fromisoformat(order["order_date"])
            lead_times.append((actual - ordered).days)
        total_cost += order.get("total_cost", 0) or 0

    avg_lead_time_days = sum(lead_times) / len(lead_times) if lead_times else 0
    reliability_score = (on_time_delivery_pct * 0.6) + (quality_score * 0.4)

    return {
        "supplier_id": supplier_id,
        "on_time_delivery_pct": round(on_time_delivery_pct, 2),
        "quality_score": round(quality_score, 2),
        "avg_lead_time_days": round(avg_lead_time_days, 2),
        "last_30_days_orders": total_orders,
        "total_cost_30_days": round(total_cost, 2),
        "reliability_score": round(reliability_score, 2),
        "updated_at": date.today().isoformat(),
    }


def update_all_supplier_performance() -> list[dict]:
    suppliers = supabase.table("suppliers").select("id").execute().data
    results = []
    low_performers = []

    for supplier in suppliers:
        sid = supplier["id"]
        perf = calculate_supplier_performance(sid)
        supabase.table("supplier_performance").upsert(
            perf,
            on_conflict="supplier_id",
        ).execute()
        results.append(perf)

        if perf["reliability_score"] < RELIABILITY_THRESHOLD:
            low_performers.append({
                "supplier_id": sid,
                "reliability_score": perf["reliability_score"],
                "on_time_delivery_pct": perf["on_time_delivery_pct"],
                "quality_score": perf["quality_score"],
            })

    logging.info(f"Updated performance for {len(suppliers)} suppliers")
    logging.info(f"Low performers (<{RELIABILITY_THRESHOLD}): {len(low_performers)}")

    return {"updated": len(results), "low_performers": low_performers}


def get_low_performers() -> list[dict]:
    cutoff = str(date.today() - timedelta(days=LOOKBACK_DAYS))

    suppliers = supabase.table("suppliers").select("id, name, rating, category").execute().data
    low_performers = []

    for supplier in suppliers:
        perf = calculate_supplier_performance(supplier["id"])
        if perf["reliability_score"] < RELIABILITY_THRESHOLD:
            low_performers.append({
                **supplier,
                **perf,
            })

    low_performers.sort(key=lambda x: x["reliability_score"])
    return low_performers


def run():
    logging.info("Starting supplier performance update...")
    result = update_all_supplier_performance()
    logging.info(f"Complete: {result}")
    return result


if __name__ == "__main__":
    run()
