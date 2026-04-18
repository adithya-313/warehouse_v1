"""
Monthly Prophet Retraining Job
Trigger: First Sunday of month, 2 AM UTC
"""

import os
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [RETRAIN] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

VELOCITY_THRESHOLD = 10.0


def get_all_products() -> list:
    """Get all products with inventory."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/inventory?select=product_id,warehouse_id",
        headers=HEADERS
    )
    return resp.json() if resp.status_code == 200 else []


def calculate_velocity(product_id: str, warehouse_id: str, days: int = 180) -> float:
    """Calculate demand velocity = total_units / days."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/stock_movements?select=quantity"
        f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&type=eq.out&date=gte.{cutoff}",
        headers=HEADERS
    )
    data = resp.json()
    if not data:
        return 0.0
    
    total = sum(row.get('quantity', 0) for row in data)
    return total / days


def get_product_demand_data(product_id: str, warehouse_id: str, days: int = 180) -> pd.DataFrame:
    """Get demand data for a product."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    all_data = []
    for offset in range(0, 5000, 1000):
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity"
            f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
            f"&type=eq.out&date=gte.{cutoff}&order=date&limit=1000&offset={offset}",
            headers=HEADERS
        )
        data = resp.json()
        if not data:
            break
        all_data.extend(data)
    
    if not all_data:
        return pd.DataFrame()
    
    df = pd.DataFrame(all_data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.groupby('date')['quantity'].sum().reset_index()
    df.columns = ['ds', 'y']
    
    full_range = pd.date_range(start=df['ds'].min(), end=df['ds'].max(), freq='D')
    df = df.set_index('ds').reindex(full_range, fill_value=0).reset_index()
    df.columns = ['ds', 'y']
    
    return df


def train_and_evaluate_prophet(df: pd.DataFrame) -> dict:
    """Train Prophet and evaluate on test set."""
    from prophet import Prophet
    
    if len(df) < 60:
        return {"success": False, "reason": "insufficient_data"}
    
    train_size = len(df) - 30
    if train_size < 30:
        return {"success": False, "reason": "insufficient_train_data"}
    
    train_df = df.iloc[:train_size]
    test_df = df.iloc[train_size:]
    
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        growth='linear',
        interval_width=0.95,
        seasonality_mode='additive',
        stan_backend=None,
    )
    
    try:
        model.fit(train_df)
        forecast = model.predict(test_df[['ds']])
        
        y_true = test_df['y'].values
        y_pred = forecast['yhat'].values
        
        mask = y_true != 0
        if mask.sum() == 0:
            return {"success": False, "reason": "no_nonzero_test"}
        
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask]))
        
        return {
            "success": True,
            "mape": round(mape * 100, 2),
            "train_days": len(train_df),
            "test_days": len(test_df),
            "model": model,
        }
    except Exception as e:
        return {"success": False, "reason": str(e)}


def get_old_mape(product_id: str, warehouse_id: str) -> float:
    """Get the last known MAPE for a product."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/forecast_metrics"
        f"?product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&order=created_at.desc&limit=1",
        headers=HEADERS
    )
    if resp.status_code != 200:
        return 100.0
    try:
        data = resp.json()
    except:
        return 100.0
    if data and isinstance(data, list) and len(data) > 0:
        return data[0].get('mape', 100.0)
    return 100.0


def save_forecast_metrics(product_id: str, warehouse_id: str, mape: float, model_version: str):
    """Save forecast metrics to database."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/forecast_metrics",
        headers=HEADERS,
        json={
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "mape": mape,
            "model_version": model_version,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return resp.status_code in (200, 201)


def retrain_all_products():
    """Main retraining job."""
    logger.info("Starting monthly Prophet retraining job")
    
    products = get_all_products()
    logger.info(f"Found {len(products)} products to evaluate")
    
    results = {
        "total": len(products),
        "viable": 0,
        "retrained": 0,
        "improved": 0,
        "degraded": 0,
        "failed": 0,
    }
    
    for i, item in enumerate(products):
        product_id = item['product_id']
        warehouse_id = item['warehouse_id']
        
        velocity = calculate_velocity(product_id, warehouse_id, days=180)
        
        if velocity < VELOCITY_THRESHOLD:
            logger.info(f"{product_id[:20]} velocity: {velocity:.1f} units/day → SKIPPED (too sparse)")
            continue
        
        logger.info(f"{product_id[:20]} velocity: {velocity:.1f} units/day → RETRAINED (viable)")
        results["viable"] += 1
        
        df = get_product_demand_data(product_id, warehouse_id, days=180)
        
        if df.empty:
            logger.warning(f"No data for {product_id}")
            results["failed"] += 1
            continue
        
        new_result = train_and_evaluate_prophet(df)
        
        if not new_result["success"]:
            logger.warning(f"Training failed: {new_result['reason']}")
            results["failed"] += 1
            continue
        
        old_mape = get_old_mape(product_id, warehouse_id)
        new_mape = new_result["mape"]
        
        model_version = f"v{datetime.now().strftime('%Y%m%d')}"
        
        if new_mape < old_mape:
            logger.info(f"IMPROVED: {old_mape:.1f}% -> {new_mape:.1f}%")
            save_forecast_metrics(product_id, warehouse_id, new_mape, model_version)
            results["improved"] += 1
        else:
            logger.info(f"DEGRADED: {old_mape:.1f}% -> {new_mape:.1f}% (keeping old model)")
            results["degraded"] += 1
        
        results["retrained"] += 1
    
    logger.info(f"Retraining complete: {results}")
    return results


def run_scheduled_retraining():
    """Entry point for scheduled job."""
    import sys
    try:
        results = retrain_all_products()
        logger.info(f"Scheduled retraining completed: {results}")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Retraining failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    logger.info("Manual retraining trigger")
    retrain_all_products()