"""
sync_agent.py — Tally XML Sync Agent
Connects to Tally ERP on localhost:9000, pulls stock data, upserts into Supabase.
Falls back to CSV upload if Tally is unreachable.
"""

import os
import csv
import xml.etree.ElementTree as ET
from datetime import date, datetime
import httpx
from supabase import create_client
from dotenv import load_dotenv
import re
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [SYNC] %(message)s")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TALLY_HOST   = os.getenv("TALLY_HOST", "localhost")
TALLY_PORT   = os.getenv("TALLY_PORT", "9000")
TALLY_URL    = f"http://{TALLY_HOST}:{TALLY_PORT}"
CSV_FALLBACK = os.getenv("CSV_FALLBACK_PATH", "fallback.csv")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Tally XML request body — pulls stock summary
# ---------------------------------------------------------------------------
TALLY_REQUEST = """<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>"""


def normalize_name(name: str) -> str:
    """Lowercase, strip whitespace, collapse special chars to single space."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9\s\-]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name.title()


def pull_from_tally() -> list[dict]:
    """Send XML request to Tally and parse the response."""
    logging.info(f"Connecting to Tally at {TALLY_URL}")
    resp = httpx.post(
        TALLY_URL,
        content=TALLY_REQUEST,
        headers={"Content-Type": "text/xml"},
        timeout=15.0,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.text)

    items = []
    for item in root.iter("STOCKITEM"):
        name_el    = item.find("NAME") or item.find("STOCKITEMNAME")
        qty_el     = item.find("CLOSINGBALANCE") or item.find("CLOSINGQTY")
        rate_el    = item.find("LASTPURCHASECOST") or item.find("RATE")
        expiry_el  = item.find("EXPIRYDATE")
        category_el= item.find("PARENT") or item.find("CATEGORY")

        name = normalize_name(name_el.text) if name_el is not None and name_el.text else None
        if not name:
            continue

        qty       = float(qty_el.text.split()[0]) if qty_el is not None and qty_el.text else 0.0
        rate      = float(rate_el.text) if rate_el is not None and rate_el.text else 0.0
        category  = category_el.text.strip() if category_el is not None and category_el.text else "General"
        expiry    = expiry_el.text.strip() if expiry_el is not None and expiry_el.text else None

        items.append({
            "name":         name,
            "category":     category,
            "quantity":     qty,
            "purchase_rate": rate,
            "expiry_date":  expiry,
            "source":       "tally",
        })
    logging.info(f"Tally: parsed {len(items)} stock items")
    return items


def pull_from_csv(path: str) -> list[dict]:
    """Read fallback CSV. Expected columns: name,category,quantity,purchase_rate,expiry_date"""
    logging.warning(f"Falling back to CSV: {path}")
    items = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append({
                "name":          normalize_name(row.get("name", "")),
                "category":      row.get("category", "General"),
                "quantity":      float(row.get("quantity", 0)),
                "purchase_rate": float(row.get("purchase_rate", 0)),
                "expiry_date":   row.get("expiry_date") or None,
                "source":        "csv",
            })
    logging.info(f"CSV: loaded {len(items)} records")
    return items


def upsert_to_supabase(items: list[dict], source: str) -> int:
    """Upsert products + inventory records. Returns count upserted."""
    count = 0
    for item in items:
        # 1. Upsert product
        resp = (
            supabase.table("products")
            .upsert(
                {
                    "name":        item["name"],
                    "category":    item["category"],
                    "expiry_date": item.get("expiry_date"),
                },
                on_conflict="name",
            )
            .execute()
        )
        if not resp.data:
            continue

        product_id = resp.data[0]["id"]

        # 2. Upsert inventory (first warehouse as default)
        wh_resp = supabase.table("warehouses").select("id").limit(1).execute()
        if not wh_resp.data:
            continue
        warehouse_id = wh_resp.data[0]["id"]

        supabase.table("inventory").upsert(
            {
                "product_id":   product_id,
                "warehouse_id": warehouse_id,
                "quantity":     item["quantity"],
            },
            on_conflict="product_id,warehouse_id",
        ).execute()

        # 3. Log stock movement (in)
        if item["quantity"] > 0:
            supabase.table("stock_movements").insert(
                {
                    "product_id":  product_id,
                    "type":        "in",
                    "quantity":    item["quantity"],
                    "warehouse_id": warehouse_id,
                    "date":        str(date.today()),
                }
            ).execute()

        count += 1

    return count


def write_sync_log(source: str, status: str, records: int, error: str = None):
    supabase.table("sync_logs").insert(
        {
            "source":          source,
            "status":          status,
            "records_synced":  records,
            "error_message":   error,
            "synced_at":       datetime.utcnow().isoformat(),
        }
    ).execute()


def run():
    source = "tally"
    try:
        items = pull_from_tally()
    except Exception as e:
        logging.warning(f"Tally unavailable: {e}")
        source = "csv"
        if not os.path.exists(CSV_FALLBACK):
            logging.error("No fallback CSV found. Aborting sync.")
            write_sync_log("tally", "failed", 0, str(e))
            return 0
        items = pull_from_csv(CSV_FALLBACK)

    try:
        count = upsert_to_supabase(items, source)
        write_sync_log(source, "success", count)
        logging.info(f"Sync complete: {count} records upserted from {source}")
        return count
    except Exception as e:
        logging.error(f"Upsert failed: {e}")
        write_sync_log(source, "failed", 0, str(e))
        return 0


if __name__ == "__main__":
    run()
