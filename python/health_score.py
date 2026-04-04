"""
health_score.py — Inventory Health Score Engine
Weighted score (0-100) + label for each product.
"""

import os
from supabase import create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [HEALTH] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

# Weight configuration
W_STOCK_LEVEL    = 0.30
W_DAYS_STOCKOUT  = 0.25
W_EXPIRY         = 0.25
W_DEMAND_TREND   = 0.20

# Days-to-stockout scoring thresholds
STOCKOUT_MAX_DAYS = 60  # 60+ days → full score for this component


def score_stock_level(quantity: float, reorder_point: float) -> float:
    """100 if qty >= 2x reorder, 0 if qty == 0."""
    if reorder_point <= 0:
        return 80.0  # no reorder point set — neutral score
    ratio = quantity / (reorder_point * 2)
    return round(min(ratio * 100, 100), 2)


def score_days_stockout(days: float | None) -> float:
    """100 if days >= STOCKOUT_MAX_DAYS, 0 if 0 days."""
    if days is None:
        return 70.0  # no demand — mostly neutral
    if days <= 0:
        return 0.0
    return round(min(days / STOCKOUT_MAX_DAYS * 100, 100), 2)


def score_expiry(expiry_risk: float) -> float:
    """Inverted expiry risk: 0 risk → 100 score, 100 risk → 0 score."""
    return round(100 - expiry_risk, 2)


def score_demand_trend(trend: str) -> float:
    return {"rising": 100.0, "stable": 70.0, "falling": 30.0}.get(trend, 70.0)


def label(score: float) -> str:
    if score >= 80:
        return "Healthy"
    if score >= 60:
        return "Monitor"
    if score >= 40:
        return "At Risk"
    return "Critical"


def run():
    logging.info("Calculating health scores...")

    analytics = (
        supabase.table("product_analytics")
        .select("product_id,days_to_stockout,expiry_risk_score,demand_trend")
        .execute()
        .data
    )

    updated = 0
    for row in analytics:
        pid = row["product_id"]

        # Fetch inventory to get qty + reorder_point
        inv = (
            supabase.table("inventory")
            .select("quantity,reorder_point")
            .eq("product_id", pid)
            .execute()
            .data
        )
        if not inv:
            continue

        qty     = sum(r["quantity"] for r in inv)
        reorder = max(r["reorder_point"] for r in inv)

        s_stock  = score_stock_level(qty, reorder)
        s_days   = score_days_stockout(row.get("days_to_stockout"))
        s_expiry = score_expiry(row.get("expiry_risk_score", 0))
        s_trend  = score_demand_trend(row.get("demand_trend", "stable"))

        health = round(
            s_stock * W_STOCK_LEVEL
            + s_days * W_DAYS_STOCKOUT
            + s_expiry * W_EXPIRY
            + s_trend * W_DEMAND_TREND,
            2,
        )
        health_label = label(health)

        supabase.table("product_analytics").update(
            {"health_score": health, "health_label": health_label}
        ).eq("product_id", pid).execute()
        updated += 1

    logging.info(f"Health scores updated for {updated} products")
    return updated


if __name__ == "__main__":
    run()
