"""
sync_monitor.py — Stale Sync Watchdog
Fires a critical alert if no sync has occurred in the last 12 hours.
Called at the end of every cron cycle by cron_runner.py.
"""

import os
from datetime import datetime, timezone, timedelta
from supabase import create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [MONITOR] %(message)s")

supabase           = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
STALE_THRESHOLD_H  = 12


def run() -> bool:
    """Returns True if sync is healthy, False if a stale alert was fired."""
    logging.info("Checking sync freshness...")

    recent = (
        supabase.table("sync_logs")
        .select("synced_at,status")
        .order("synced_at", desc=True)
        .limit(1)
        .execute()
        .data
    )

    now       = datetime.now(timezone.utc)
    threshold = now - timedelta(hours=STALE_THRESHOLD_H)

    is_stale = True
    if recent:
        raw       = recent[0]["synced_at"]
        last_sync = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if last_sync >= threshold:
            is_stale = False
            logging.info(f"Last sync: {last_sync.isoformat()} — OK")

    if is_stale:
        msg = (
            f"No successful sync in the last {STALE_THRESHOLD_H} hours. "
            "Inventory data may be stale. Check Tally connection or upload CSV manually."
        )
        logging.warning(msg)

        # Check if this alert already exists (unresolved)
        existing = (
            supabase.table("alerts")
            .select("id")
            .is_("product_id", None)
            .eq("type", "stale_sync")
            .eq("resolved", False)
            .execute()
            .data
        )
        if not existing:
            supabase.table("alerts").insert(
                {
                    "product_id": None,
                    "type":       "stale_sync",
                    "severity":   "critical",
                    "message":    msg,
                    "resolved":   False,
                }
            ).execute()
            logging.info("Stale sync alert created in alerts table")
        return False

    return True


if __name__ == "__main__":
    result = run()
    print("Sync healthy:", result)
