"""
Drift Monitoring & Reliability Scoring
Calculates MAPE and Bias for all products
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Tuple, List, Dict, Optional

import pandas as pd
import numpy as np

from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

DRIFT_THRESHOLD = 20.0
VELOCITY_THRESHOLD = 10.0
MIN_HISTORY_DAYS = 30


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true > 0
    if mask.sum() == 0:
        return float('inf')
    
    y_true_filtered = y_true[mask]
    y_pred_filtered = y_pred[mask]
    
    mape = np.mean(np.abs((y_true_filtered - y_pred_filtered) / y_true_filtered)) * 100
    return float(min(mape, 999.99))


def calculate_bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if y_true.sum() == 0:
        return 0.0
    
    bias = np.sum(y_true - y_pred) / np.sum(y_true) * 100
    return float(bias)


def get_forecast_comparison_data(
    supabase,
    product_id: str,
    days_back: int = 30
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    result = supabase.table("demand_forecasts").select(
        "forecast_date, predicted_qty"
    ).eq("product_id", product_id).gte("forecast_date", cutoff_date).execute()
    
    forecasts = pd.DataFrame(result.data or [])
    
    if forecasts.empty:
        return pd.DataFrame(), pd.DataFrame()
    
    actual_result = supabase.table("stock_movements").select(
        "date, quantity_change"
    ).eq("product_id", product_id).gte("date", cutoff_date).execute()
    
    actuals = pd.DataFrame(actual_result.data or [])
    
    return forecasts, actuals


def calculate_product_metrics(
    supabase,
    product_id: str,
    days_back: int = 30
) -> Optional[Dict]:
    forecasts_df, actuals_df = get_forecast_comparison_data(supabase, product_id, days_back)
    
    if forecasts_df.empty or actuals_df.empty:
        return None
    
    if 'forecast_date' in forecasts_df.columns and 'date' in actuals_df.columns:
        forecasts_df = forecasts_df.rename(columns={'forecast_date': 'date'})
    
    forecasts_df['date'] = pd.to_datetime(forecasts_df['date'])
    actuals_df['date'] = pd.to_datetime(actuals_df['date'])
    
    merged = forecasts_df.merge(actuals_df, on='date', how='inner', suffixes=('_forecast', '_actual'))
    
    if len(merged) < 7:
        return None
    
    y_true = merged['quantity_change'].values if 'quantity_change' in merged.columns else merged['predicted_qty'].values
    y_pred = merged['predicted_qty'].values if 'predicted_qty' in merged.columns else merged['quantity_change'].values
    
    y_true = np.abs(y_true)
    y_pred = np.abs(y_pred)
    
    mape = calculate_mape(y_true, y_pred)
    bias = calculate_bias(y_true, y_pred)
    
    return {
        "mape": round(mape, 2),
        "bias": round(bias, 2),
        "samples": len(merged),
        "last_forecast_date": merged['date'].max().isoformat(),
    }


def calculate_reliability_score(mape: float, bias: float) -> float:
    score = 100.0
    
    if mape < 10:
        score += 10
    elif mape < 20:
        score += 5
    elif mape > 50:
        score -= 20
    elif mape > 30:
        score -= 10
    
    if abs(bias) < 5:
        score += 5
    elif abs(bias) > 20:
        score -= 10
    elif abs(bias) > 10:
        score -= 5
    
    return max(0, min(100, score))


def get_velocity(supabase, product_id: str, days: int = 180) -> float:
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    result = supabase.table("stock_movements").select(
        "quantity_change"
    ).eq("product_id", product_id).eq("movement_type", "out").gte("created_at", cutoff).execute()
    
    data = result.data or []
    if not data:
        return 0.0
    
    total = sum(abs(row.get('quantity_change', 0)) for row in data)
    return total / days


def update_product_analytics(supabase, product_id: str, metrics: Dict):
    reliability = calculate_reliability_score(metrics['mape'], metrics['bias'])
    
    result = supabase.table("product_analytics").upsert({
        "product_id": product_id,
        "reliability_score": reliability,
        "updated_at": datetime.now().isoformat(),
    }, on_conflict="product_id").execute()
    
    if result.error:
        logger.warning(f"Failed to update product_analytics for {product_id}: {result.error}")
    
    return reliability


def save_drift_log(supabase, product_id: str, metrics: Dict, status: str):
    supabase.table("forecast_drift_log").insert({
        "product_id": product_id,
        "week_ending_date": datetime.now().strftime('%Y-%m-%d'),
        "mape": metrics['mape'],
        "bias": metrics['bias'],
        "reliability_score": calculate_reliability_score(metrics['mape'], metrics['bias']),
        "alert_status": status,
        "created_at": datetime.now().isoformat(),
    }).execute()


def send_alert(supabase, product_id: str, metrics: Dict, alert_type: str = "DRIFT"):
    supabase.table("alert_notifications").insert({
        "product_id": product_id,
        "alert_type": alert_type,
        "mape": metrics['mape'],
        "bias": metrics['bias'],
        "created_at": datetime.now().isoformat(),
    }).execute()
    
    logger.warning(f"ALERT: {product_id} MAPE={metrics['mape']}% Bias={metrics['bias']}%")


def run_drift_monitoring():
    logger.info("=" * 50)
    logger.info("Starting Drift Monitoring")
    logger.info("=" * 50)
    
    supabase = get_supabase_client()
    
    result = supabase.table("products").select("id").execute()
    products = result.data or []
    
    logger.info(f"Monitoring {len(products)} products")
    
    results = {
        "total": len(products),
        "viable": 0,
        "monitored": 0,
        "healthy": 0,
        "drift_alerts": 0,
    }
    
    for product in products:
        product_id = product['id']
        
        velocity = get_velocity(supabase, product_id)
        
        if velocity < VELOCITY_THRESHOLD:
            logger.debug(f"{product_id[:8]} velocity {velocity:.1f} < {VELOCITY_THRESHOLD} - skipping")
            continue
        
        results["viable"] += 1
        
        metrics = calculate_product_metrics(supabase, product_id)
        
        if metrics is None:
            continue
        
        results["monitored"] += 1
        
        reliability = update_product_analytics(supabase, product_id, metrics)
        save_drift_log(supabase, product_id, metrics, "HEALTHY")
        
        if metrics['mape'] > DRIFT_THRESHOLD:
            results["drift_alerts"] += 1
            send_alert(supabase, product_id, metrics, "MAPE_DRIFT")
            logger.warning(f"DRIFT: {product_id} MAPE={metrics['mape']}%")
        else:
            results["healthy"] += 1
    
    logger.info(f"Drift monitoring complete: {results}")
    
    drift_rate = results["drift_alerts"] / results["viable"] * 100 if results["viable"] > 0 else 0
    
    if drift_rate > 10:
        send_alert(supabase, "SYSTEM", {
            "mape": drift_rate,
            "bias": 0,
        }, "HIGH_DRIFT_RATE")
    
    return results


if __name__ == "__main__":
    import sys
    from pathlib import Path
    
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    
    results = run_drift_monitoring()
    print(f"Results: {results}")