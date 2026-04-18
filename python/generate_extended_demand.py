"""
Extended Synthetic Demand Data Generator (365 days)
Generates for all products in inventory
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [DATA] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

PRODUCT_TYPES = {
    'fast': {'base': 55},
    'medium': {'base': 15},
    'slow': {'base': 5},
    'dead': {'base': 1}
}


def get_inventory_products() -> list:
    """Get all products from inventory with warehouse mapping."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/inventory?select=product_id,warehouse_id",
        headers=HEADERS
    )
    return resp.json() if resp.status_code == 200 else []


def generate_demand_data(
    product_id: str,
    product_type: str,
    warehouse_id: str,
    days: int = 365,
    seed: int = 42
) -> list:
    """Generate 365-day demand with realistic patterns."""
    np.random.seed(seed + sum(ord(c) for c in product_id) % 10000)
    
    base = PRODUCT_TYPES[product_type]['base']
    
    start_date = datetime.now() - timedelta(days=days)
    records = []
    
    dates = pd.date_range(start=start_date, periods=days, freq='D')
    
    for i, date in enumerate(dates):
        day = i + 1
        trend = 1.0 + (day / 365 * 0.05)
        
        day_of_week = date.weekday()
        weekly = {0: 1.1, 1: 0.9, 2: 1.2, 3: 1.15, 4: 1.1, 5: 1.0, 6: 0.95}.get(day_of_week, 1.0)
        
        day_of_month = date.day
        if day_of_month <= 7:
            monthly = 0.85
        elif day_of_month <= 20:
            monthly = 1.15
        else:
            monthly = 0.95
        
        month = date.month
        if month in [10, 11]:
            festival = 1.08
        elif month in [6, 7, 8]:
            festival = 1.03
        elif month in [3, 4]:
            festival = 1.05
        else:
            festival = 1.0
        
        day_of_year = date.timetuple().tm_yday
        quarter = (day_of_year // 91) + 1
        quarterly = {1: 1.0, 2: 1.15, 3: 0.85, 4: 1.2}.get(quarter, 1.0)
        
        noise = np.random.normal(1.0, 0.018)
        
        event = 1.0
        if np.random.random() < 0.008:
            spike_days = np.random.randint(3, 5)
            for j in range(spike_days):
                if i + j < days:
                    event = 1.8
        
        demand = base * trend * weekly * monthly * festival * quarterly * noise * event
        demand = max(1, int(demand * 0.5))
        demand = min(demand, 150)
        
        records.append({
            'date': date.strftime('%Y-%m-%d'),
            'product_id': product_id,
            'quantity': demand,
            'type': 'out',
            'warehouse_id': warehouse_id
        })
    
    return records


def insert_demand_batch(records: list) -> int:
    """Insert all records in batch."""
    if not records:
        return 0
    
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/stock_movements",
        headers=HEADERS,
        json=records
    )
    
    if resp.status_code in (200, 201):
        return len(records)
    else:
        logger.error(f"Insert failed: {resp.text[:200]}")
        return 0


def validate_patterns():
    """Validate generated data patterns."""
    logger.info("Loading data for validation...")
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,product_id,quantity&type=eq.out&limit=10000",
        headers=HEADERS
    )
    
    data = resp.json()
    if not data:
        logger.warning("No data found")
        return
    
    df = pd.DataFrame(data)
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_week'] = df['date'].dt.day_name()
    df['day_of_month'] = df['date'].dt.day
    df['quarter'] = df['date'].dt.quarter
    df['month'] = df['date'].dt.to_period('M')
    
    logger.info("=== DEMAND STATISTICS ===")
    avg = df['quantity'].mean()
    std = df['quantity'].std()
    non_zero = (df['quantity'] > 0).sum() / len(df)
    logger.info(f"Overall | Avg: {avg:.1f} | Std: {std:.1f} | Non-zero: {non_zero*100:.1f}%")
    
    logger.info("\n=== WEEKLY PATTERN ===")
    weekly = df.groupby('day_of_week')['quantity'].mean()
    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        if day in weekly.index:
            logger.info(f"  {day:10}: {weekly[day]:6.1f}")
    
    logger.info("\n=== MONTHLY PATTERN ===")
    monthly = df.groupby('day_of_month')['quantity'].mean()
    early = monthly.get(slice(1, 10), pd.Series()).mean()
    mid = monthly.get(slice(10, 20), pd.Series()).mean()
    late = monthly.get(slice(20, 31), pd.Series()).mean()
    logger.info(f"  Early (1-10): {early:.1f}")
    logger.info(f"  Mid (10-20): {mid:.1f}")
    logger.info(f"  Late (21-31): {late:.1f}")
    
    logger.info("\n=== QUARTERLY PATTERN ===")
    quarterly = df.groupby('quarter')['quantity'].mean()
    for q in [1, 2, 3, 4]:
        if q in quarterly.index:
            logger.info(f"  Q{q}: {quarterly[q]:.1f}")
    
    logger.info("\n=== ANNUAL TREND ===")
    monthly_avg = df.groupby('month')['quantity'].mean()
    if len(monthly_avg) >= 2:
        growth = ((monthly_avg.iloc[-1] - monthly_avg.iloc[0]) / monthly_avg.iloc[0]) * 100
        logger.info(f"  Growth: {growth:+.1f}%")
    
    logger.info("\n=== VOLATILITY ===")
    volatility = (std / avg) * 100 if avg > 0 else 0
    logger.info(f"  Volatility: {volatility:.1f}% (Expected: 25-35%)")
    if 25 <= volatility <= 35:
        logger.info("  ✓ PASS")
    else:
        logger.warning("  ! Outside range")


def train_prophet():
    """Train Prophet and validate."""
    try:
        from prophet import Prophet
        
        logger.info("\n=== PROPHET TRAINING ===")
        
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity&type=eq.out&order=date&limit=10000",
            headers=HEADERS
        )
        
        data = resp.json()
        if not data:
            logger.warning("No data")
            return
        
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.groupby('date')['quantity'].sum().reset_index()
        df.columns = ['ds', 'y']
        
        min_date = df['ds'].min()
        max_date = df['ds'].max()
        actual_days = (max_date - min_date).days + 1
        
        logger.info(f"Data range: {actual_days} days ({min_date.date()} to {max_date.date()})")
        
        if len(df) < 90:
            logger.warning(f"Insufficient data: {len(df)} days (need 90+)")
            return
        
        df = df.set_index('ds').reindex(pd.date_range(df['ds'].min(), df['ds'].max(), freq='D'), fill_value=0).reset_index()
        df.columns = ['ds', 'y']
        
        train_size = int(len(df) * 0.8)
        train_df = df.iloc[:train_size]
        test_df = df.iloc[train_size:]
        
        logger.info(f"Train: {len(train_df)} days, Test: {len(test_df)} days")
        
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            growth='linear',
            interval_width=0.95,
            stan_backend=None
        )
        model.add_seasonality(name='monthly', period=30.5, fourier_order=3)
        model.add_seasonality(name='quarterly', period=91.25, fourier_order=2)
        
        model.fit(train_df)
        
        future = test_df[['ds']]
        forecast = model.predict(future)
        
        y_true = test_df['y'].values
        y_pred = forecast['yhat'].values
        
        mask = y_true != 0
        if mask.sum() > 0:
            mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask]))
            logger.info(f"MAPE: {mape*100:.1f}%")
            
            if mape < 0.15:
                logger.info("✓ MAPE < 15% - Good forecast")
            else:
                logger.warning("! MAPE > 15%")
        
    except Exception as e:
        logger.error(f"Prophet failed: {e}")


def main():
    logger.info("Generating 365-day demand data for all products...")
    
    inventory = get_inventory_products()
    logger.info(f"Found {len(inventory)} product-warehouse pairs")
    
    if not inventory:
        logger.error("No products found")
        return
    
    all_records = []
    product_order = list(PRODUCT_TYPES.keys())
    
    for i, item in enumerate(inventory):
        product_id = item['product_id']
        warehouse_id = item['warehouse_id']
        product_type = product_order[i % len(product_order)]
        
        logger.info(f"  {product_id[:20]}... @ {warehouse_id[:20]}... ({product_type})")
        
        records = generate_demand_data(
            product_id=product_id,
            product_type=product_type,
            warehouse_id=warehouse_id,
            days=365,
            seed=42
        )
        all_records.extend(records)
    
    logger.info(f"Total records to insert: {len(all_records)}")
    
    batch_size = 1000
    total_inserted = 0
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i:i + batch_size]
        inserted = insert_demand_batch(batch)
        total_inserted += inserted
        logger.info(f"  Inserted {inserted} records")
    
    logger.info(f"Total inserted: {total_inserted}")
    
    validate_patterns()
    train_prophet()


if __name__ == "__main__":
    main()