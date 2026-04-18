"""
Weekly Drift Monitoring Job
Trigger: Every Sunday at 3 AM UTC
"""

import os
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [DRIFT] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

VELOCITY_THRESHOLD = 10.0
DRIFT_THRESHOLD = 20.0
CONSECUTIVE_WEEKS_THRESHOLD = 2


def get_all_products() -> list:
    """Get all products."""
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


def get_recent_demand(product_id: str, warehouse_id: str, days: int = 30) -> pd.DataFrame:
    """Get recent demand for a product."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity"
        f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&type=eq.out&date=gte.{cutoff}&order=date",
        headers=HEADERS
    )
    data = resp.json()
    
    if not data:
        return pd.DataFrame()
    
    df = pd.DataFrame(data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.groupby('date')['quantity'].sum().reset_index()
    return df


def calculate_rolling_mape(product_id: str, warehouse_id: str) -> float:
    """Calculate MAPE on last 30 days by retraining on older data."""
    from prophet import Prophet
    
    recent = get_recent_demand(product_id, warehouse_id, days=30)
    
    if recent.empty or len(recent) < 7:
        return None
    
    train_cutoff = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity"
        f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&type=eq.out&date=lt.{train_cutoff}&order=date",
        headers=HEADERS
    )
    train_data = resp.json()
    
    if not train_data or len(train_data) < 30:
        cutoff = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d')
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity"
            f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
            f"&type=eq.out&date=gte.{cutoff}&date=lt.{train_cutoff}&order=date",
            headers=HEADERS
        )
        train_data = resp.json()
    
    if not train_data or len(train_data) < 30:
        return None
    
    df_train = pd.DataFrame(train_data)
    df_train['date'] = pd.to_datetime(df_train['date'])
    df_train = df_train.groupby('date')['quantity'].sum().reset_index()
    df_train.columns = ['ds', 'y']
    
    full_range = pd.date_range(start=df_train['ds'].min(), end=df_train['ds'].max(), freq='D')
    df_train = df_train.set_index('ds').reindex(full_range, fill_value=0).reset_index()
    df_train.columns = ['ds', 'y']
    
    try:
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            growth='linear',
            seasonality_mode='additive',
        )
        model.fit(df_train)
        
        test_dates = recent['ds'] if 'ds' in recent.columns else recent['date']
        forecast = model.predict(pd.DataFrame({'ds': test_dates}))
        
        y_true = recent['y'].values if 'y' in recent.columns else recent['quantity'].values
        y_pred = forecast['yhat'].values
        
        mask = y_true != 0
        if mask.sum() == 0:
            return None
        
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask]))
        return round(mape * 100, 2)
    except Exception as e:
        logger.warning(f"MAPE calculation failed for {product_id}: {e}")
        return None


def get_previous_mape(product_id: str, warehouse_id: str) -> float:
    """Get MAPE from last week."""
    last_week = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/forecast_drift_log"
        f"?product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&week_ending_date=gte.{last_week}&order=week_ending_date.desc&limit=1",
        headers=HEADERS
    )
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except:
        return None
    if data and isinstance(data, list) and len(data) > 0:
        return data[0].get('mape')
    return None


def save_drift_log(product_id: str, warehouse_id: str, mape: float, status: str):
    """Save drift monitoring result."""
    week_ending = datetime.now().strftime('%Y-%m-%d')
    
    requests.post(
        f"{SUPABASE_URL}/rest/v1/forecast_drift_log",
        headers=HEADERS,
        json={
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "week_ending_date": week_ending,
            "mape": mape,
            "alert_status": status,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


def check_consecutive_alerts(product_id: str, warehouse_id: str) -> bool:
    """Check if MAPE > threshold for 2+ consecutive weeks."""
    last_3_weeks = (datetime.now() - timedelta(days=21)).strftime('%Y-%m-%d')
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/forecast_drift_log"
        f"?product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
        f"&week_ending_date=gte.{last_3_weeks}&order=week_ending_date.desc&limit=3",
        headers=HEADERS
    )
    data = resp.json()
    
    if len(data) >= CONSECUTIVE_WEEKS_THRESHOLD:
        recent_mapes = [d['mape'] for d in data[:CONSECUTIVE_WEEKS_THRESHOLD]]
        if all(m > DRIFT_THRESHOLD for m in recent_mapes):
            return True
    return False


def send_alert(product_id: str, warehouse_id: str, mape: float, trend: str):
    """Send alert to ops team."""
    logger.warning(f"ALERT: Product {product_id} MAPE={mape}% ({trend})")
    
    alert_payload = {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "mape": mape,
        "threshold": DRIFT_THRESHOLD,
        "trend": trend,
        "alert_type": "FORECAST_DRIFT",
    }
    
    requests.post(
        f"{SUPABASE_URL}/rest/v1/alert_notifications",
        headers=HEADERS,
        json=alert_payload
    )


def run_drift_monitoring():
    """Main drift monitoring job."""
    logger.info("Starting weekly drift monitoring")
    
    products = get_all_products()
    logger.info(f"Monitoring {len(products)} products")
    
    results = {
        "total": len(products),
        "viable": 0,
        "monitored": 0,
        "alerts": 0,
        "healthy": 0,
    }
    
    for item in products:
        product_id = item['product_id']
        warehouse_id = item['warehouse_id']
        
        velocity = calculate_velocity(product_id, warehouse_id, days=180)
        
        if velocity < VELOCITY_THRESHOLD:
            logger.info(f"{product_id[:20]} velocity: {velocity:.1f} units/day → SKIPPED (too sparse)")
            continue
        
        logger.info(f"{product_id[:20]} velocity: {velocity:.1f} units/day → MONITORED (viable)")
        results["viable"] += 1
        
        current_mape = calculate_rolling_mape(product_id, warehouse_id)
        
        if current_mape is None:
            continue
        
        results["monitored"] += 1
        
        if current_mape > DRIFT_THRESHOLD:
            prev_mape = get_previous_mape(product_id, warehouse_id)
            
            if prev_mape and prev_mape > DRIFT_THRESHOLD:
                status = "ALERT"
                if check_consecutive_alerts(product_id, warehouse_id):
                    send_alert(product_id, warehouse_id, current_mape, "worsening")
                    results["alerts"] += 1
            else:
                status = "WARNING"
                results["alerts"] += 1
        else:
            status = "HEALTHY"
            results["healthy"] += 1
        
        save_drift_log(product_id, warehouse_id, current_mape, status)
    
    logger.info(f"Drift monitoring complete: {results}")
    return results


if __name__ == "__main__":
    run_drift_monitoring()