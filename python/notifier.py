"""
notifier.py — WhatsApp (WATI) + Email (Resend) Notifications
Graceful no-op if API keys are missing.
"""

import os
import httpx
import logging
from datetime import date
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [NOTIFY] %(message)s")

WATI_API_KEY     = os.getenv("WATI_API_KEY")
WATI_PHONE       = os.getenv("WATI_PHONE_NUMBER")   # e.g. "919876543210"
WATI_BASE_URL    = "https://live-mt-server.wati.io"  # Change to your WATI instance
RESEND_API_KEY   = os.getenv("RESEND_API_KEY")
DIGEST_EMAIL_TO  = os.getenv("DIGEST_EMAIL_TO", "")


# ---------------------------------------------------------------------------
# WhatsApp via WATI
# ---------------------------------------------------------------------------

def send_whatsapp(product_name: str, message: str, action: str) -> bool:
    """Send a single WhatsApp alert via WATI."""
    if not WATI_API_KEY or not WATI_PHONE:
        logging.warning("WATI credentials not configured — skipping WhatsApp alert")
        return False

    text = f"🚨 ALERT [{product_name}]: {message}\n\n✅ Recommended action: {action}"
    try:
        resp = httpx.post(
            f"{WATI_BASE_URL}/api/v1/sendSessionMessage/{WATI_PHONE}",
            headers={
                "Authorization": f"Bearer {WATI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"messageText": text},
            timeout=10.0,
        )
        resp.raise_for_status()
        logging.info(f"WhatsApp sent for: {product_name}")
        return True
    except Exception as e:
        logging.error(f"WhatsApp send failed: {e}")
        return False


def send_whatsapp_batch(alerts: list[tuple[str, str, str]]):
    """alerts: [(product_name, message, action), ...]"""
    for name, msg, action in alerts:
        send_whatsapp(name, msg, action)


# ---------------------------------------------------------------------------
# Daily digest via Resend
# ---------------------------------------------------------------------------

def build_digest_html(critical_alerts: list[dict], avg_health: float, top_5: list[dict]) -> str:
    alert_rows = "\n".join(
        f"<tr><td>{a['product']}</td><td>{a['severity'].upper()}</td><td>{a['message']}</td></tr>"
        for a in critical_alerts[:10]
    )
    top5_rows = "\n".join(
        f"<tr><td>{p['name']}</td><td>{p['health_score']:.0f}</td><td>{p['health_label']}</td></tr>"
        for p in top_5
    )
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;">
  <h1 style="color:#38bdf8;">📦 Warehouse Daily Digest — {date.today()}</h1>
  <h2 style="color:#fbbf24;">⚠ Critical Alerts ({len(critical_alerts)})</h2>
  <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;color:#e2e8f0;border-color:#334155;">
    <tr style="background:#1e293b;"><th>Product</th><th>Severity</th><th>Message</th></tr>
    {alert_rows}
  </table>
  <h2 style="color:#34d399;">📊 Health Summary</h2>
  <p>Average Health Score across all products: <strong>{avg_health:.1f}/100</strong></p>
  <h2 style="color:#f87171;">🔴 Top 5 Products Needing Attention</h2>
  <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;color:#e2e8f0;border-color:#334155;">
    <tr style="background:#1e293b;"><th>Product</th><th>Health Score</th><th>Status</th></tr>
    {top5_rows}
  </table>
  <p style="color:#64748b;font-size:12px;margin-top:32px;">Sent by Warehouse AI at 08:00 IST. Do not reply to this email.</p>
</body>
</html>"""


def send_daily_digest():
    """Fetch data from Supabase and send digest email via Resend."""
    if not RESEND_API_KEY or not DIGEST_EMAIL_TO:
        logging.warning("Resend credentials not configured — skipping digest email")
        return False

    from supabase import create_client
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    # Fetch critical alerts
    alerts_data = (
        sb.table("alerts")
        .select("product_id,severity,message,products(name)")
        .eq("resolved", False)
        .in_("severity", ["critical", "warning"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    )
    crit_list = [
        {
            "product":  a.get("products", {}).get("name", "Unknown"),
            "severity": a["severity"],
            "message":  a["message"],
        }
        for a in alerts_data
    ]

    # Fetch avg health score
    analytics = sb.table("product_analytics").select("health_score").execute().data
    scores    = [r["health_score"] for r in analytics if r.get("health_score") is not None]
    avg_health = sum(scores) / len(scores) if scores else 0

    # Top 5 lowest health scores
    top_5 = (
        sb.table("product_analytics")
        .select("product_id,health_score,health_label,products(name)")
        .order("health_score", desc=False)
        .limit(5)
        .execute()
        .data
    )
    top_5_fmt = [
        {
            "name":         r.get("products", {}).get("name", "Unknown"),
            "health_score": r.get("health_score", 0),
            "health_label": r.get("health_label", ""),
        }
        for r in top_5
    ]

    html = build_digest_html(crit_list, avg_health, top_5_fmt)

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from":    "Warehouse AI <alerts@yourdomain.com>",
                "to":      [DIGEST_EMAIL_TO],
                "subject": f"📦 Warehouse Daily Digest — {date.today()}",
                "html":    html,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        logging.info("Daily digest email sent successfully")
        return True
    except Exception as e:
        logging.error(f"Email digest failed: {e}")
        return False


if __name__ == "__main__":
    send_daily_digest()
