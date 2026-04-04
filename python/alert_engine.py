"""
alert_engine.py — Smart Alert Generator
Reads product_analytics and creates alerts + action recommendations.
Calls notifier.py for critical alerts.
"""

import os
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ALERTS] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def make_action(alert_type: str, row: dict, product_name: str) -> str:
    """Generate a human-readable recommended action string."""
    if alert_type == "stockout":
        days = row.get("days_to_stockout", 0)
        return (
            f"Reorder {product_name} immediately. Estimated {days:.1f} days of stock remaining. "
            "Suggested order quantity: 3× reorder point from assigned supplier."
        )
    if alert_type == "expiry":
        risk = row.get("expiry_risk_score", 0)
        discount = 15 if risk < 85 else 30
        return (
            f"Apply {discount}% discount on {product_name}. Move to front-of-shelf display. "
            "Notify sales team to prioritise clearance."
        )
    if alert_type == "dead_stock":
        return (
            f"No movement recorded for {product_name} in 30+ days. "
            "Consider transferring to another warehouse or initiating supplier return."
        )
    if alert_type == "health":
        return (
            f"{product_name} Health Score is critically low. "
            "Review all risk factors and escalate to warehouse manager."
        )
    return "Review product status and take appropriate action."


def upsert_alert(product_id: str, alert_type: str, severity: str, message: str, action: str):
    """Insert alert if it doesn't already exist (unresolved). Attach action."""
    existing = (
        supabase.table("alerts")
        .select("id")
        .eq("product_id", product_id)
        .eq("type", alert_type)
        .eq("resolved", False)
        .execute()
        .data
    )
    if existing:
        return existing[0]["id"], False  # already exists

    alert_resp = (
        supabase.table("alerts")
        .insert(
            {
                "product_id": product_id,
                "type":       alert_type,
                "severity":   severity,
                "message":    message,
                "resolved":   False,
            }
        )
        .execute()
    )
    if not alert_resp.data:
        return None, False

    alert_id = alert_resp.data[0]["id"]

    supabase.table("actions").insert(
        {"alert_id": alert_id, "recommendation": action}
    ).execute()

    return alert_id, True


def run():
    logging.info("Running alert engine...")

    analytics = (
        supabase.table("product_analytics")
        .select(
            "product_id,days_to_stockout,expiry_risk_score,classification,health_score"
        )
        .execute()
        .data
    )

    products_resp = supabase.table("products").select("id,name").execute().data
    product_names = {p["id"]: p["name"] for p in products_resp}

    critical_alerts = []
    new_count = 0

    for row in analytics:
        pid  = row["product_id"]
        name = product_names.get(pid, "Unknown Product")
        days = row.get("days_to_stockout")
        risk = row.get("expiry_risk_score", 0) or 0
        health = row.get("health_score", 100) or 100
        classification = row.get("classification", "")

        # --- Stockout alerts ---
        if days is not None:
            if days < 7:
                msg = f"{name}: CRITICAL — only {days:.1f} days of stock remaining."
                action = make_action("stockout", row, name)
                aid, is_new = upsert_alert(pid, "stockout", "critical", msg, action)
                if is_new:
                    new_count += 1
                    critical_alerts.append((name, msg, action))
            elif days < 14:
                msg    = f"{name}: WARNING — {days:.1f} days to stockout."
                action = make_action("stockout", row, name)
                upsert_alert(pid, "stockout", "warning", msg, action)
                new_count += 1

        # --- Expiry risk alerts ---
        if risk > 90:
            msg    = f"{name}: CRITICAL expiry risk ({risk:.0f}/100). Immediate clearance needed."
            action = make_action("expiry", row, name)
            aid, is_new = upsert_alert(pid, "expiry", "critical", msg, action)
            if is_new:
                new_count += 1
                critical_alerts.append((name, msg, action))
        elif risk > 70:
            msg    = f"{name}: expiry risk score {risk:.0f}/100. Consider discount."
            action = make_action("expiry", row, name)
            upsert_alert(pid, "expiry", "warning", msg, action)
            new_count += 1

        # --- Dead stock alerts ---
        if classification == "Dead Stock":
            msg    = f"{name}: classified as Dead Stock — no movement in 30+ days."
            action = make_action("dead_stock", row, name)
            upsert_alert(pid, "dead_stock", "info", msg, action)
            new_count += 1

        # --- Health score alerts ---
        if health < 40:
            msg    = f"{name}: Health Score {health:.0f} — Critical. Immediate action required."
            action = make_action("health", row, name)
            aid, is_new = upsert_alert(pid, "health", "critical", msg, action)
            if is_new:
                new_count += 1
                critical_alerts.append((name, msg, action))

    logging.info(f"Alert engine: {new_count} new alerts generated")

    # Fire notifications for critical alerts (import here to avoid circular deps)
    if critical_alerts:
        try:
            from notifier import send_whatsapp_batch
            send_whatsapp_batch(critical_alerts)
        except Exception as e:
            logging.warning(f"WhatsApp notification failed: {e}")

    return new_count


if __name__ == "__main__":
    run()
