"""
ml/generate_real_demand.py - Realistic Warehouse Demand Generator

Generates "lumpy" warehouse demand data that mimics real Indian warehouse patterns:
- Poisson distribution for discrete counts
- Zero-inflation (60-70% zeros for SLOW_MOVING products)
- Holiday multipliers (Diwali, Holi, Eid - 2x to 5x spikes)
- Sunday operational dips (30-50% reduction)
- Random walk trend drift (concept drift)
- Fetches from products table, inserts into stock_movements

Run: python ml/generate_real_demand.py
"""

import os
import sys
import random
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [DEMAND] %(message)s"
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

INDIAN_HOLIDAYS = [
    {"name": "Diwali", "month": 11, "day": 1, "pre_days": 3, "multiplier": 4.0},
    {"name": "Holi", "month": 3, "day": 25, "pre_days": 2, "multiplier": 3.5},
    {"name": "Eid", "month": 4, "day": 10, "pre_days": 2, "multiplier": 3.0},
    {"name": "Independence Day", "month": 8, "day": 15, "pre_days": 1, "multiplier": 2.5},
    {"name": "Republic Day", "month": 1, "day": 26, "pre_days": 1, "multiplier": 2.0},
    {"name": "Gandhi Jayanti", "month": 10, "day": 2, "pre_days": 1, "multiplier": 2.0},
    {"name": "Ganesh Chaturthi", "month": 9, "day": 7, "pre_days": 2, "multiplier": 3.0},
    {"name": "Durga Puja", "month": 10, "day": 9, "pre_days": 2, "multiplier": 3.5},
    {"name": "Navratri", "month": 10, "day": 3, "pre_days": 3, "multiplier": 3.0},
    {"name": "Mahashivratri", "month": 3, "day": 8, "pre_days": 1, "multiplier": 2.5},
    {"name": "Janmashtami", "month": 8, "day": 26, "pre_days": 1, "multiplier": 2.5},
    {"name": "Raksha Bandhan", "month": 8, "day": 9, "pre_days": 1, "multiplier": 2.0},
    {"name": "Pongal", "month": 1, "day": 14, "pre_days": 1, "multiplier": 2.5},
    {"name": "Onam", "month": 9, "day": 15, "pre_days": 2, "multiplier": 3.0},
]

BATCH_IDS = [f"BATCH-{i:04d}" for i in range(1, 101)]

random.seed(42)
np.random.seed(42)


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def check_holiday(date: datetime) -> Tuple[bool, Optional[str], float]:
    """
    Check if date is a holiday or pre-holiday spike period.
    Returns (is_holiday_or_pre, holiday_name, multiplier)
    """
    for holiday in INDIAN_HOLIDAYS:
        holiday_date = datetime(date.year, holiday["month"], holiday["day"])
        
        for pre_offset in range(holiday["pre_days"] + 1):
            check_date = holiday_date - timedelta(days=pre_offset)
            if date.date() == check_date.date():
                if pre_offset == 0:
                    return True, holiday["name"], holiday["multiplier"]
                else:
                    return True, f"{holiday['name']} (pre)", holiday["multiplier"] * (1 - pre_offset * 0.15)
    
    return False, None, 1.0


class RandomWalkTrend:
    """Random walk for concept drift - slow stochastic drift over time"""
    
    def __init__(self, initial_value: float, volatility: float = 0.02):
        self.value = initial_value
        self.volatility = volatility
    
    def step(self) -> float:
        drift = np.random.normal(0, self.volatility)
        self.value = self.value * (1 + drift)
        self.value = max(0.1, self.value)
        return self.value


class RealisticDemandGenerator:
    """
    Generates realistic warehouse demand with:
    - Poisson distribution for discrete counts
    - Zero-inflation for slow-moving items
    - Holiday multipliers
    - Sunday dips
    - Random walk trend drift
    """
    
    def __init__(
        self,
        n_days: int = 365,
        zero_inflation_rate: float = 0.65,
        sunday_dip: float = 0.35,
        trend_volatility: float = 0.02
    ):
        self.n_days = n_days
        self.zero_inflation_rate = zero_inflation_rate
        self.sunday_dip = sunday_dip
        self.trend_volatility = trend_volatility
    
    def generate_for_product(
        self,
        product_id: str,
        classification: str,
        base_demand: float
    ) -> List[Dict]:
        """
        Generate 365 days of demand for a single product.
        """
        records = []
        
        zero_inflation = (
            classification in ["SLOW_MOVING", "DEAD_STOCK", "Seasonal"]
            if classification
            else random.random() < self.zero_inflation_rate
        )
        
        trend = RandomWalkTrend(base_demand, self.trend_volatility)
        
        start_date = datetime.now() - timedelta(days=self.n_days)
        
        for day_offset in range(self.n_days):
            current_date = start_date + timedelta(days=day_offset)
            
            is_holiday, holiday_name, holiday_multiplier = check_holiday(current_date)
            
            day_of_week = current_date.weekday()
            is_sunday = day_of_week == 6
            
            current_baseline = trend.step()
            
            if zero_inflation and random.random() < self.zero_inflation_rate:
                demand = 0
            else:
                demand = np.random.poisson(current_baseline)
                
                if is_sunday:
                    demand = int(demand * (1 - self.sunday_dip))
                
                if is_holiday:
                    demand = int(demand * holiday_multiplier)
                
                noise = np.random.normal(0, max(1, demand * 0.1))
                demand = max(0, int(demand + noise))
            
            batch_id = random.choice(BATCH_IDS) if demand > 0 else None
            
            records.append({
                "product_id": product_id,
                "quantity_change": demand,
                "movement_type": "out",
                "metadata": json.dumps({
                    "batch_id": batch_id,
                    "generated_at": datetime.now().isoformat(),
                    "holiday": holiday_name if is_holiday else None,
                    "day_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_of_week]
                }),
                "date": current_date.strftime("%Y-%m-%d"),
                "created_at": current_date.isoformat(),
            })
        
        return records


def fetch_products(supabase) -> List[Dict]:
    """Fetch all products from the products table"""
    logger.info("Fetching products from database...")
    
    result = supabase.table("products").select("id, category").execute()
    
    if not result.data:
        logger.warning("No products found in database")
        return []
    
    logger.info(f"Found {len(result.data)} products")
    return result.data


def fetch_classifications(supabase) -> Dict[str, Dict]:
    """Fetch product classifications and analytics"""
    logger.info("Fetching product classifications...")
    
    result = supabase.table("product_analytics").select(
        "product_id, classification, avg_daily_demand"
    ).execute()
    
    if not result.data:
        return {}
    
    classifications = {}
    for row in result.data:
        classifications[row["product_id"]] = row
    
    logger.info(f"Found classifications for {len(classifications)} products")
    return classifications


def determine_base_demand(classification: str, avg_demand: Optional[float]) -> float:
    """Determine base demand based on classification"""
    if classification == "Fast Moving":
        return avg_demand if avg_demand and avg_demand > 10 else random.uniform(15, 50)
    elif classification == "Slow Moving":
        return avg_demand if avg_demand and avg_demand > 1 else random.uniform(2, 8)
    elif classification == "Seasonal":
        return avg_demand if avg_demand else random.uniform(5, 20)
    elif classification == "Dead Stock":
        return random.uniform(0.1, 1)
    else:
        return avg_demand if avg_demand else random.uniform(5, 25)


def insert_demand_data(supabase, records: List[Dict], batch_size: int = 1000):
    """Insert demand records into stock_movements table"""
    logger.info(f"Inserting {len(records)} records into stock_movements...")
    
    inserted = 0
    errors = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        
        try:
            result = supabase.table("stock_movements").upsert(
                batch,
                on_conflict="id",
                ignore_duplicates=True
            ).execute()
            
            inserted += len(batch)
            logger.info(f"Inserted batch {i//batch_size + 1}: {len(batch)} records")
            
        except Exception as e:
            errors += len(batch)
            logger.error(f"Batch insert error: {e}")
    
    logger.info(f"Insert complete: {inserted} inserted, {errors} errors")
    return inserted, errors


def generate_and_insert_demand(
    n_days: int = 365,
    zero_inflation_rate: float = 0.65,
    sunday_dip: float = 0.35,
    dry_run: bool = False
):
    """
    Main function to generate and insert realistic demand data.
    """
    logger.info("=" * 60)
    logger.info("Starting Realistic Demand Generation")
    logger.info("=" * 60)
    
    supabase = get_supabase_client()
    
    products = fetch_products(supabase)
    
    if not products:
        logger.error("No products to generate demand for")
        return
    
    classifications = fetch_classifications(supabase)
    
    generator = RealisticDemandGenerator(
        n_days=n_days,
        zero_inflation_rate=zero_inflation_rate,
        sunday_dip=sunday_dip,
        trend_volatility=0.02
    )
    
    all_records = []
    
    logger.info("Generating demand data...")
    
    for i, product in enumerate(products):
        product_id = product["id"]
        category = product.get("category", "General")
        
        analytics = classifications.get(product_id, {})
        classification = analytics.get("classification")
        avg_demand = analytics.get("avg_daily_demand")
        
        base_demand = determine_base_demand(classification, avg_demand)
        
        records = generator.generate_for_product(
            product_id=product_id,
            classification=classification,
            base_demand=base_demand
        )
        
        all_records.extend(records)
        
        if (i + 1) % 10 == 0:
            logger.info(f"Processed {i + 1}/{len(products)} products...")
    
    logger.info(f"Generated {len(all_records)} total demand records")
    
    if dry_run:
        logger.info("DRY RUN - Not inserting into database")
        df = pd.DataFrame(all_records[:1000])
        logger.info(f"Sample data:\n{df.head()}")
        return
    
    inserted, errors = insert_demand_data(supabase, all_records)
    
    logger.info("=" * 60)
    logger.info("Generation Complete!")
    logger.info(f"Total records: {len(all_records)}")
    logger.info(f"Inserted: {inserted}")
    logger.info(f"Errors: {errors}")
    logger.info("=" * 60)
    
    return {
        "total": len(all_records),
        "inserted": inserted,
        "errors": errors
    }


def generate_sample_csv(output_path: str = "realistic_demand.csv"):
    """Generate a CSV sample without database insertion"""
    logger.info("Generating sample CSV...")
    
    supabase = get_supabase_client()
    products = fetch_products(supabase)[:50]
    classifications = fetch_classifications(supabase)
    
    generator = RealisticDemandGenerator(n_days=365)
    
    all_records = []
    
    for product in products:
        product_id = product["id"]
        analytics = classifications.get(product_id, {})
        classification = analytics.get("classification")
        avg_demand = analytics.get("avg_daily_demand")
        
        base_demand = determine_base_demand(classification, avg_demand)
        
        records = generator.generate_for_product(
            product_id=product_id,
            classification=classification,
            base_demand=base_demand
        )
        
        all_records.extend(records)
    
    df = pd.DataFrame(all_records)
    df.to_csv(output_path, index=False)
    
    logger.info(f"Saved {len(df)} records to {output_path}")
    
    stats = {
        "total_records": len(df),
        "zero_demands": (df["quantity_change"] == 0).sum(),
        "non_zero_demands": (df["quantity_change"] > 0).sum(),
        "avg_demand": df[df["quantity_change"] > 0]["quantity_change"].mean(),
        "max_demand": df["quantity_change"].max(),
    }
    
    logger.info(f"Stats: {stats}")
    
    return stats


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate realistic warehouse demand data")
    parser.add_argument("--days", type=int, default=365, help="Number of days to generate")
    parser.add_argument("--zero-rate", type=float, default=0.65, help="Zero-inflation rate (0-1)")
    parser.add_argument("--sunday-dip", type=float, default=0.35, help="Sunday demand dip (0-1)")
    parser.add_argument("--dry-run", action="store_true", help="Generate but don't insert")
    parser.add_argument("--csv", type=str, help="Output CSV path (no DB insert)")
    
    args = parser.parse_args()
    
    if args.csv:
        generate_sample_csv(args.csv)
    else:
        generate_and_insert_demand(
            n_days=args.days,
            zero_inflation_rate=args.zero_rate,
            sunday_dip=args.sunday_dip,
            dry_run=args.dry_run
        )
