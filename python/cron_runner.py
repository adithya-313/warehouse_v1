"""
cron_runner.py — Orchestrates the full pipeline every 6 hours.

Usage:
  python cron_runner.py              # run once
  python cron_runner.py --dry-run   # print plan, no DB writes
  python cron_runner.py --schedule  # run in a loop every 6 hours (for Railway)

OS cron equivalent (add to crontab):
  0 */6 * * * cd /path/to/python && python cron_runner.py >> cron.log 2>&1
"""

import sys
import logging
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CRON] %(message)s")

DRY_RUN          = "--dry-run" in sys.argv
SCHEDULE_MODE    = "--schedule" in sys.argv
INTERVAL_SECONDS = 6 * 60 * 60  # 6 hours


def pipeline(dry_run: bool = False):
    steps = [
        ("sync_agent",   "Sync from Tally / CSV"),
        ("etl_pipeline", "ETL: demand, stockout, expiry risk"),
        ("health_score", "Calculate health scores"),
        ("classifier",   "Classify product movement"),
        ("alert_engine", "Generate alerts + actions"),
        ("sync_monitor", "Check sync freshness"),
    ]

    import datetime
    is_1am = datetime.datetime.now().hour == 1
    is_2am = datetime.datetime.now().hour == 2
    is_3am = datetime.datetime.now().hour == 3
    is_4am = datetime.datetime.now().hour == 4

    results = {}
    for module_name, description in steps:
        logging.info(f"▶ {description}")
        if dry_run:
            logging.info(f"  [DRY RUN] Would execute {module_name}.run()")
            results[module_name] = "skipped (dry-run)"
            continue
        try:
            mod    = __import__(module_name)
            result = mod.run()
            results[module_name] = result
            logging.info(f"  ✔ {module_name} → {result}")
        except Exception as e:
            logging.error(f"  ✘ {module_name} failed: {e}")
            results[module_name] = f"ERROR: {e}"

    if is_2am and not dry_run:
        try:
            from forecast_engine import generate_all_forecasts
            logging.info("▶ Generating demand forecasts (2 AM job)")
            generate_all_forecasts()
        except Exception as e:
            logging.warning(f"Demand forecast skipped: {e}")

    if is_3am and not dry_run:
        try:
            from forecast_engine import generate_all_liquidation
            logging.info("▶ Generating liquidation recommendations (3 AM job)")
            generate_all_liquidation()
        except Exception as e:
            logging.warning(f"Liquidation recommendations skipped: {e}")

    if is_4am and not dry_run:
        try:
            from supplier_performance import update_all_supplier_performance
            logging.info("▶ Updating supplier performance metrics (4 AM job)")
            update_all_supplier_performance()
        except Exception as e:
            logging.warning(f"Supplier performance skipped: {e}")

    if not dry_run and datetime.datetime.now().hour == 8:
        try:
            from notifier import send_daily_digest
            logging.info("▶ Sending daily digest email")
            send_daily_digest()
        except Exception as e:
            logging.warning(f"Digest email skipped: {e}")

    if is_1am and not dry_run:
        try:
            from gst_compliance_engine import detect_shrinkage_anomalies
            logging.info("▶ Running shrinkage detection (1 AM job)")
            result = detect_shrinkage_anomalies()
            logging.info(f"  Shrinkage detection: {result.get('total_alerts', 0)} alerts created")
        except Exception as e:
            logging.warning(f"Shrinkage detection skipped: {e}")

    if is_2am and not dry_run:
        try:
            from gst_compliance_engine import reconcile_gst_transactions
            from supabase import create_client
            import os
            
            logging.info("▶ Running GST reconciliation (2 AM job)")
            supabase_url = os.environ.get("SUPABASE_URL")
            supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            
            if supabase_url and supabase_key:
                supabase = create_client(supabase_url, supabase_key)
                warehouses = supabase.table("warehouses").select("id").execute().data or []
                
                recon_date = datetime.datetime.now().strftime("%Y-%m-%d")
                for wh in warehouses:
                    result = reconcile_gst_transactions(wh["id"], recon_date)
                    logging.info(f"  Warehouse {wh['id']}: {result.get('audit_status', 'unknown')}")
            else:
                logging.warning("Supabase credentials not configured for GST reconciliation")
        except Exception as e:
            logging.warning(f"GST reconciliation skipped: {e}")

    logging.info("Pipeline complete.")
    if dry_run:
        logging.info("DRY RUN summary — no data was written.")
        for m, r in results.items():
            logging.info(f"  {m}: {r}")

    return results


def main():
    if SCHEDULE_MODE:
        logging.info(f"Starting scheduled mode — running every {INTERVAL_SECONDS // 3600}h")
        while True:
            pipeline(dry_run=DRY_RUN)
            logging.info(f"Sleeping {INTERVAL_SECONDS // 3600} hours...")
            time.sleep(INTERVAL_SECONDS)
    else:
        pipeline(dry_run=DRY_RUN)


if __name__ == "__main__":
    main()
