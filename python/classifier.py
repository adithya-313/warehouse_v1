"""
classifier.py — Product Movement Classifier
Labels each product as: Fast Moving / Slow Moving / Dead Stock / Seasonal / Expiry Risk
"""

import os
from datetime import date, timedelta
from supabase import create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [CLASSIFY] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

FAST_THRESHOLD    = 10.0   # units/day
SLOW_MIN          = 1.0
DEAD_DAYS         = 30
EXPIRY_RISK_DAYS  = 30
SEASONAL_VARIANCE = 0.5    # CoV threshold for seasonal classification


def classify(product: dict, analytics: dict) -> str:
    avg_demand   = analytics.get("avg_daily_demand", 0) or 0
    expiry_risk  = analytics.get("expiry_risk_score", 0) or 0

    # Expiry risk first (specific over generic)
    if expiry_risk > 70:
        return "Expiry Risk"

    if avg_demand >= FAST_THRESHOLD:
        return "Fast Moving"

    if avg_demand >= SLOW_MIN:
        # Check seasonal: fetch monthly demand variance from last 6 months
        # Simplified: if demand_trend == rising or falling with significant variance
        if analytics.get("demand_trend") in ("rising", "falling") and avg_demand < FAST_THRESHOLD:
            return "Seasonal"
        return "Slow Moving"

    # avg_demand < 1 — check dead stock
    cutoff    = str(date.today() - timedelta(days=DEAD_DAYS))
    movements = (
        supabase.table("stock_movements")
        .select("id")
        .eq("product_id", product["id"])
        .gte("date", cutoff)
        .limit(1)
        .execute()
        .data
    )
    if not movements:
        return "Dead Stock"

    return "Slow Moving"


def run():
    logging.info("Classifying products...")

    products  = supabase.table("products").select("id,expiry_date").execute().data
    analytics_rows = (
        supabase.table("product_analytics")
        .select("product_id,avg_daily_demand,expiry_risk_score,demand_trend")
        .execute()
        .data
    )
    analytics_map = {r["product_id"]: r for r in analytics_rows}

    updated = 0
    for product in products:
        pid     = product["id"]
        row     = analytics_map.get(pid, {})
        label   = classify(product, row)

        supabase.table("product_analytics").update(
            {"classification": label}
        ).eq("product_id", pid).execute()
        updated += 1

    logging.info(f"Classification complete: {updated} products labelled")
    return updated


if __name__ == "__main__":
    run()
