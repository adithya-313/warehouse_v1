"""
etl_pipeline.py — Demand + Stockout + Expiry Risk Calculator
Reads from Supabase, computes analytics, writes to product_analytics.
"""

import os
from datetime import date, timedelta
from supabase import create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ETL] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

LOOKBACK_DAYS    = 30
EXPIRY_RISK_DAYS = 90  # window in which expiry risk starts climbing


def calc_expiry_risk(expiry_date_str: str | None) -> float:
    """Score 0-100: 0 = far away or no expiry, 100 = already expired."""
    if not expiry_date_str:
        return 0.0
    try:
        expiry = date.fromisoformat(expiry_date_str)
    except ValueError:
        return 0.0

    days_remaining = (expiry - date.today()).days
    if days_remaining <= 0:
        return 100.0
    if days_remaining >= EXPIRY_RISK_DAYS:
        return 0.0
    # Linear 0→100 as days go from 90→0
    return round((1 - days_remaining / EXPIRY_RISK_DAYS) * 100, 2)


def calc_demand_trend(daily_demand: float, movements: list[dict]) -> str:
    """Compare first-half vs second-half of lookback window."""
    if not movements or daily_demand == 0:
        return "stable"
    mid = LOOKBACK_DAYS // 2
    cutoff = date.today() - timedelta(days=mid)
    recent = sum(m["quantity"] for m in movements if date.fromisoformat(m["date"]) >= cutoff)
    older  = sum(m["quantity"] for m in movements if date.fromisoformat(m["date"]) < cutoff)
    if older == 0:
        return "rising" if recent > 0 else "stable"
    ratio = recent / (older + 1e-9)
    if ratio > 1.3:
        return "rising"
    if ratio < 0.7:
        return "falling"
    return "stable"


def run():
    logging.info("Starting ETL pipeline...")

    # Fetch all products
    products = supabase.table("products").select("id,expiry_date").execute().data
    cutoff   = str(date.today() - timedelta(days=LOOKBACK_DAYS))
    updated  = 0

    for product in products:
        pid = product["id"]

        # Fetch outbound movements in last 30 days
        movements = (
            supabase.table("stock_movements")
            .select("quantity,date")
            .eq("product_id", pid)
            .eq("type", "out")
            .gte("date", cutoff)
            .execute()
            .data
        )

        total_out        = sum(m["quantity"] for m in movements)
        avg_daily_demand = round(total_out / LOOKBACK_DAYS, 4)

        # Current stock
        inv = supabase.table("inventory").select("quantity").eq("product_id", pid).execute().data
        current_qty = sum(r["quantity"] for r in inv) if inv else 0

        days_to_stockout = (
            round(current_qty / avg_daily_demand, 2) if avg_daily_demand > 0 else None
        )

        expiry_risk  = calc_expiry_risk(product.get("expiry_date"))
        demand_trend = calc_demand_trend(avg_daily_demand, movements)

        # Upsert into product_analytics (health_score filled by health_score.py next)
        supabase.table("product_analytics").upsert(
            {
                "product_id":         pid,
                "avg_daily_demand":   avg_daily_demand,
                "days_to_stockout":   days_to_stockout,
                "expiry_risk_score":  expiry_risk,
                "demand_trend":       demand_trend,
                "updated_at":         date.today().isoformat(),
            },
            on_conflict="product_id",
        ).execute()
        updated += 1

    logging.info(f"ETL complete: {updated} products updated")
    return updated


if __name__ == "__main__":
    run()
