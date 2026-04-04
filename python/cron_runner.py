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

    # Daily digest: fire only if current hour is 8 (08:00 local)
    import datetime
    if not dry_run and datetime.datetime.now().hour == 8:
        try:
            from notifier import send_daily_digest
            logging.info("▶ Sending daily digest email")
            send_daily_digest()
        except Exception as e:
            logging.warning(f"Digest email skipped: {e}")

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
