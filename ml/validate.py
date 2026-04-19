import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd

import xgboost as xgb
from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MODEL_VERSIONS = {
    "xgboost": "v1_latest",
    "tft": "v1_latest"
}

MAPE_TOLERANCE_DEGRADATION = 0.15
MIN_TEST_SAMPLES = 50


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true > 0
    if np.sum(mask) < 3:
        return float('inf')
    
    y_true_filtered = y_true[mask]
    y_pred_filtered = y_pred[mask]
    
    ape = np.abs((y_true_filtered - y_pred_filtered) / y_true_filtered)
    mape = np.mean(ape) * 100
    
    return float(mape)


def get_test_data(supabase, days_back: int = 7) -> pd.DataFrame:
    start_date = (datetime.now() - timedelta(days=days_back + 30)).strftime('%Y-%m-%d')
    end_date = (datetime.now() - timedelta(days=days_back - 1)).strftime('%Y-%m-%d')
    
    result = supabase.table("daily_demand_timeseries").select(
        "product_id, product_name, date, net_quantity"
    ).gte("date", start_date).lte("date", end_date).execute()
    
    df = pd.DataFrame(result.data if result.data else [])
    
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values(["product_id", "date"])
    
    logger.info(f"Loaded {len(df)} rows for test period ({days_back} days)")
    return df


def get_training_features(supabase, product_id: str, date: str) -> Optional[Dict]:
    test_date = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
    
    result = supabase.table("ml_feature_store").select(
        "lag_1d, lag_7d, rolling_avg_7d, rolling_avg_14d, rolling_std_7d"
    ).eq("product_id", product_id).lte("feature_date", test_date).order("feature_date", desc=True).limit(1).execute()
    
    if not result.data:
        return None
    
    return result.data[0]


def load_xgboost_model(supabase, version: str = "v1_latest") -> Optional[xgb.XGBRegressor]:
    bucket = "ml-models"
    file_path = f"xgboost/{version}/model.bin"
    
    try:
        result = supabase.storage.from_(bucket).download(file_path)
        
        model = xgb.XGBRegressor()
        model.load_model(result)
        
        logger.info(f"Loaded XGBoost model: {version}")
        return model
    except Exception as e:
        logger.warning(f"Could not load XGBoost model: {e}")
        return None


def predict_with_model(model: xgb.XGBRegressor, features: Dict) -> float:
    feature_cols = ["lag_1d", "lag_7d", "rolling_avg_7d", "rolling_avg_14d", "rolling_std_7d"]
    
    feature_vector = np.array([[features.get(c, 0) for c in feature_cols]])
    
    pred = model.predict(feature_vector)
    return float(max(0, pred[0]))


def fallback_predict(features: Dict) -> float:
    base = features.get("rolling_avg_7d", features.get("lag_1d", 10))
    return max(0, base)


def run_validation(prod_version: str = "v1_latest", new_version: str = None) -> Tuple[bool, Dict]:
    logger.info("=" * 50)
    logger.info("Starting Model Validation")
    logger.info("=" * 50)
    
    supabase = get_supabase_client()
    
    df = get_test_data(supabase, days_back=7)
    
    if df.empty:
        logger.error("No test data available")
        return False, {"error": "No test data available"}
    
    df = df.groupby("product_id").filter(lambda x: len(x) >= 5)
    
    test_products = df["product_id"].unique()[:10]
    
    results = {
        "prod": {"mape": [], "samples": 0},
        "new": {"mape": [], "samples": 0},
        "baseline": {"mape": [], "samples": 0}
    }
    
    for product_id in test_products:
        product_df = df[df["product_id"] == product_id].sort_values("date")
        
        for idx, row in product_df.iterrows():
            date = row["date"].strftime('%Y-%m-%d')
            actual = row["net_quantity"]
            
            features = get_training_features(supabase, product_id, date)
            
            if not features:
                continue
            
            baseline_pred = fallback_predict(features)
            baseline_mape = abs((actual - baseline_pred) / actual) * 100 if actual > 0 else 0
            results["baseline"]["mape"].append(baseline_mape)
            results["baseline"]["samples"] += 1
            
            prod_pred = None
            try:
                prod_model = load_xgboost_model(supabase, prod_version)
                if prod_model:
                    prod_pred = predict_with_model(prod_model, features)
                    prod_mape = abs((actual - prod_pred) / actual) * 100 if actual > 0 else 0
                    results["prod"]["mape"].append(prod_mape)
                    results["prod"]["samples"] += 1
            except Exception as e:
                logger.warning(f"Prod model prediction failed: {e}")
            
            new_pred = None
            try:
                if new_version:
                    new_model = load_xgboost_model(supabase, new_version)
                    if new_model:
                        new_pred = predict_with_model(new_model, features)
                        new_mape = abs((actual - new_pred) / actual) * 100 if actual > 0 else 0
                        results["new"]["mape"].append(new_mape)
                        results["new"]["samples"] += 1
                else:
                    results["new"]["mape"] = results["prod"]["mape"]
                    results["new"]["samples"] = results["prod"]["samples"]
            except Exception as e:
                logger.warning(f"New model prediction failed: {e}")
    
    prod_mape = np.median(results["prod"]["mape"]) if results["prod"]["mape"] else float('inf')
    new_mape = np.median(results["new"]["mape"]) if results["new"]["mape"] else float('inf')
    baseline_mape = np.median(results["baseline"]["mape"]) if results["baseline"]["mape"] else float('inf')
    
    metrics = {
        "prod_mape": round(prod_mape, 2),
        "new_mape": round(new_mape, 2),
        "baseline_mape": round(baseline_mape, 2),
        "samples_tested": results["prod"]["samples"],
        "prod_available": results["prod"]["samples"] >= MIN_TEST_SAMPLES,
    }
    
    logger.info(f"Results: {json.dumps(metrics, indent=2)}")
    
    prod_mape_threshold = baseline_mape * 1.5
    
    if not metrics["prod_available"]:
        logger.error("Insufficient test samples")
        return False, metrics
    
    if new_mape > prod_mape * (1 + MAPE_TOLERANCE_DEGRADATION):
        logger.error(f"NEW MODEL REJECTED: MAPE degraded by {MAPE_TOLERANCE_DEGRADATION*100}%")
        logger.error(f"  Prod MAPE: {prod_mape:.2f}%")
        logger.error(f"  New MAPE: {new_mape:.2f}%")
        logger.error(f"  Threshold: {prod_mape * (1 + MAPE_TOLERANCE_DEGRADATION):.2f}%")
        
        send_alert(metrics, "MAPE_DEGRADATION", f"New model MAPE {new_mape:.2f}% > threshold {prod_mape*(1+MAPE_TOLERANCE_DEGRADATION):.2f}%")
        
        return False, metrics
    
    if new_mape > prod_mape_threshold:
        logger.warning(f"New model MAPE ({new_mape:.2f}%) worse than baseline threshold ({prod_mape_threshold:.2f}%)")
        send_alert(metrics, "THRESHOLD_EXCEEDED", f"New model MAPE {new_mape:.2f}% exceeds threshold")
    
    logger.info("Validation PASSED - New model accepted")
    
    return True, metrics


def send_alert(metrics: Dict, alert_type: str, message: str):
    webhook_url = os.getenv("ALERT_WEBHOOK_URL")
    
    if not webhook_url:
        logger.info("No alert webhook configured")
        return
    
    payload = {
        "text": f"ML Validation Alert: {alert_type}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{alert_type}* :warning:\n{message}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Prod MAPE:*\n{metrics.get('prod_mape', 'N/A')}%"},
                    {"type": "mrkdwn", "text": f"*New MAPE:*\n{metrics.get('new_mape', 'N/A')}%"},
                    {"type": "mrkdwn", "text": f"*Samples:*\n{metrics.get('samples_tested', 0)}"},
                    {"type": "mrkdwn", "text": f"*Timestamp:*\n{datetime.now().isoformat()}"}
                ]
            }
        ]
    }
    
    try:
        import urllib.request
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=10)
        logger.info("Alert sent successfully")
    except Exception as e:
        logger.warning(f"Failed to send alert: {e}")


def run_validation_with_exit(new_version: str = None):
    success, metrics = run_validation(new_version=new_version)
    
    if not success:
        logger.error("VALIDATION FAILED - Exiting with code 1")
        sys.exit(1)
    
    logger.info("VALIDATION PASSED - Exiting with code 0")
    sys.exit(0)


if __name__ == "__main__":
    import sys
    from pathlib import Path
    
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    
    new_version = sys.argv[1] if len(sys.argv) > 1 else None
    
    run_validation_with_exit(new_version)