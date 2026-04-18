import os
import sys
import logging
from datetime import datetime, timedelta
from random import randint, uniform
from typing import List

import pandas as pd
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

print(f"[DEBUG] SUPABASE_URL prefix: {SUPABASE_URL[:15] if SUPABASE_URL else 'NONE'}")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is not set!")
if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY is not set!")

def make_uuid(prefix: str, num: int) -> str:
    num_str = f"{num:03d}"
    return f"{prefix}-0000-0000-0000-{num_str.zfill(12)}"

PRODUCT_UUIDS = [make_uuid("c1000000", i) for i in range(1, 31)]

CATALOG = [
    {"name": "Whole Wheat Atta (10kg)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[0]},
    {"name": "Refined Cooking Oil (5L)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[1]},
    {"name": "Basmati Rice (5kg)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[2]},
    {"name": "Toor Dal (1kg)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[3]},
    {"name": "Sugar (1kg)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[4]},
    {"name": "Iodized Salt (1kg)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[5]},
    {"name": "Turmeric Powder (200g)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[6]},
    {"name": "Red Chilli Powder (200g)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[7]},
    {"name": "Coriander Powder (200g)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[8]},
    {"name": "Tea Leaves (500g)", "category": "FMCG_Staples", "uuid": PRODUCT_UUIDS[9]},
    {"name": "Paracetamol 500mg (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[10]},
    {"name": "Amoxicillin 250mg (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[11]},
    {"name": "Metformin 500mg (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[12]},
    {"name": "Cetirizine 10mg (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[13]},
    {"name": "ORS Sachets (pack)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[14]},
    {"name": "Bandages (pack)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[15]},
    {"name": "Antiseptic Liquid (100ml)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[16]},
    {"name": "Cough Syrup (100ml)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[17]},
    {"name": "Vitamin B-Complex (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[18]},
    {"name": "Iron Tablets (strip)", "category": "Pharma_Healthcare", "uuid": PRODUCT_UUIDS[19]},
    {"name": "Drill Bit Set (piece)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[20]},
    {"name": "Safety Helmet (piece)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[21]},
    {"name": "Safety Gloves (pair)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[22]},
    {"name": "Cable Ties (pack)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[23]},
    {"name": "PVC Tape (roll)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[24]},
    {"name": "Wire Connectors (pack)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[25]},
    {"name": "Lubricant Spray (can)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[26]},
    {"name": "Nuts_Bolts Assorted (pack)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[27]},
    {"name": "Work Lamp (piece)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[28]},
    {"name": "Extension Cord (piece)", "category": "Industrial_MRO", "uuid": PRODUCT_UUIDS[29]},
]

WEEKLY_WEIGHTS = {
    "FMCG_Staples": [2.5, 1.8, 1.2, 1.0, 1.3, 1.9, 2.8],
    "Pharma_Healthcare": [1.8, 2.2, 1.8, 1.2, 1.0, 1.5, 1.5],
    "Industrial_MRO": [1.0, 1.2, 1.5, 1.3, 1.1, 1.4, 1.0],
}

BASE_DEMAND = {
    "FMCG_Staples": 45,
    "Pharma_Healthcare": 25,
    "Industrial_MRO": 8,
}

WAREHOUSE_ID = "a1000000-0000-0000-0000-000000000001"

def get_supabase():
    assert SUPABASE_URL and SUPABASE_KEY
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_products(supabase):
    logger.info("=== SEEDING 30 PRODUCTS WITH FIXED UUIDs ===")
    
    deleted = 0
    for i, item in enumerate(PRODUCT_UUIDS):
        try:
            result = supabase.table("products").delete().eq("id", item).execute()
            deleted += 1
        except:
            pass
    
    logger.info(f"Cleared {deleted} existing products")
    
    for item in CATALOG:
        supabase.table("products").insert({
            "id": item["uuid"],
            "name": item["name"],
            "category": item["category"],
            "unit": "unit",
            "expiry_date": None,
            "supplier_id": None,
        }).execute()
        logger.info(f"  Inserted: {item['name']} ({item['uuid']})")
    
    logger.info(f"Seeded {len(CATALOG)} products")
    return len(CATALOG)

def seed_transactions(supabase):
    logger.info("=== GENERATING 365 DAYS × 30 PRODUCTS ===")
    
    all_transactions = []
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=365)
    num_days = 365
    
    for item in CATALOG:
        category = item["category"]
        base_qty = BASE_DEMAND.get(category, 20)
        weekly_weights = WEEKLY_WEIGHTS.get(category, [1.0] * 7)
        
        for day_offset in range(num_days):
            date = start_date + timedelta(days=day_offset)
            weekday = date.weekday()
            
            trend_factor = 1 + (0.005 * day_offset / 30)
            base = base_qty * trend_factor * weekly_weights[weekday]
            noise = np.random.normal(0, 1)
            cv = 0.35
            qty = max(1, int(base + (base * cv * noise)))
            
            all_transactions.append({
                "product_id": item["uuid"],
                "type": "out",
                "quantity": qty,
                "warehouse_id": WAREHOUSE_ID,
                "date": date.strftime("%Y-%m-%d"),
            })
    
    logger.info(f"Generated {len(all_transactions)} transactions total")
    
    for pid in PRODUCT_UUIDS:
        supabase.table("stock_movements").delete().eq("product_id", pid).execute()
    
    batch_size = 500
    for i in range(0, len(all_transactions), batch_size):
        batch = all_transactions[i:i+batch_size]
        supabase.table("stock_movements").insert(batch).execute()
        logger.info(f"  Inserted batch {i//batch_size + 1}: {len(batch)} rows")
    
    return len(all_transactions)

def seed_inventory(supabase):
    logger.info("=== SEEDING INVENTORY ===")
    
    for item in CATALOG:
        category = item["category"]
        base_qty = BASE_DEMAND.get(category, 20)
        current_stock = randint(200, 800)
        reorder_point = int(base_qty * 14 * 0.7)
        
        supabase.table("inventory").upsert({
            "product_id": item["uuid"],
            "warehouse_id": WAREHOUSE_ID,
            "quantity": current_stock,
            "reorder_point": reorder_point,
        }).execute()
    
    logger.info(f"Seeded inventory for {len(CATALOG)} products")
    return len(CATALOG)

def verify_data(supabase):
    logger.info("=== VERIFICATION ===")
    
    products = supabase.table("products").select("id").execute()
    logger.info(f"  Products: {len(products.data)}")
    
    transactions = supabase.table("stock_movements").select("id").execute()
    logger.info(f"  Transactions: {len(transactions.data)}")
    
    inventory = supabase.table("inventory").select("id").execute()
    logger.info(f"  Inventory records: {len(inventory.data)}")
    
    return {
        "products": len(products.data),
        "transactions": len(transactions.data),
        "inventory": len(inventory.data),
    }

def main():
    logger.info("=== STARTING HIGH-FIDELITY SEED ===")
    
    supabase = get_supabase()
    
    product_count = seed_products(supabase)
    transaction_count = seed_transactions(supabase)
    inventory_count = seed_inventory(supabase)
    
    stats = verify_data(supabase)
    
    logger.info("=" * 50)
    logger.info("SEEDING COMPLETE")
    logger.info(f"  Products: {stats['products']}")
    logger.info(f"  Transactions: {stats['transactions']}")
    logger.info(f"  Inventory: {stats['inventory']}")
    logger.info("=" * 50)
    
    if stats['transactions'] >= 10950:
        logger.info("SUCCESS: 10,950 rows added!")
    else:
        logger.warning(f"WARNING: Expected 10950 transactions, got {stats['transactions']}")
    
    return stats

if __name__ == "__main__":
    stats = main()