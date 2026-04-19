import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any
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

INDIAN_HOLIDAYS = [
    {"name": "Diwali", "month": 11, "day": 1},
    {"name": "Holi", "month": 3, "day": 25},
    {"name": "Independence Day", "month": 8, "day": 15},
    {"name": "Republic Day", "month": 1, "day": 26},
    {"name": "Gandhi Jayanti", "month": 10, "day": 2},
    {"name": "Ganesh Chaturthi", "month": 9, "day": 7},
    {"name": "Durga Puja", "month": 10, "day": 9},
    {"name": "Navratri", "month": 10, "day": 3},
    {"name": "Mahashivratri", "month": 3, "day": 8},
    {"name": "Janmashtami", "month": 8, "day": 26},
]


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def check_holiday(date: datetime) -> Tuple[bool, Optional[str]]:
    for holiday in INDIAN_HOLIDAYS:
        if date.month == holiday["month"] and date.day == holiday["day"]:
            return True, holiday["name"]
    return False, None


def get_latest_features(supabase, product_id: str) -> Optional[Dict[str, Any]]:
    result = supabase.table("ml_feature_store").select(
        "product_id, feature_date, rolling_avg_7d, rolling_avg_14d, rolling_avg_30d, "
        "lag_1d, lag_7d, day_of_week, is_holiday, is_weekend, is_month_end, is_month_start"
    ).eq("product_id", product_id).order("feature_date", desc=True).limit(1).execute()
    
    if not result.data:
        return None
    
    return result.data[0]


def get_demand_history(supabase, product_id: str, days: int = 30) -> pd.DataFrame:
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    result = supabase.table("daily_demand_timeseries").select(
        "date, net_quantity"
    ).eq("product_id", product_id).gte("date", start_date).order("date").execute()
    
    df = pd.DataFrame(result.data if result.data else [])
    
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    
    return df


def prepare_features_for_prediction(
    features: Dict[str, Any],
    forecast_date: datetime
) -> np.ndarray:
    day_of_week = forecast_date.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    is_holiday, _ = check_holiday(forecast_date)
    is_month_start = 1 if forecast_date.day <= 5 else 0
    is_month_end = 1 if forecast_date.day >= 25 else 0
    
    feature_vector = np.array([[
        features.get("lag_1d", 0),
        features.get("lag_7d", 0),
        features.get("rolling_avg_7d", 0),
        features.get("rolling_avg_14d", 0),
        features.get("rolling_std_7d", 0),
        day_of_week,
        is_weekend,
        is_month_start,
        is_month_end,
        1 if is_holiday else 0,
    ]])
    
    return feature_vector


def load_xgboost_model(supabase) -> Optional[xgb.XGBRegressor]:
    bucket = "ml-models"
    file_path = f"xgboost/{MODEL_VERSIONS['xgboost']}/model.bin"
    
    try:
        result = supabase.storage.from_(bucket).download(file_path)
        
        model = xgb.XGBRegressor()
        model.load_model(result)
        
        logger.info(f"Loaded XGBoost model from {file_path}")
        return model
    except Exception as e:
        logger.warning(f"Could not load XGBoost model: {e}")
        return None


def load_model_metadata(supabase, model_type: str) -> Optional[Dict]:
    bucket = "ml-models"
    file_path = f"{model_type}/{MODEL_VERSIONS[model_type]}/metadata.json"
    
    try:
        result = supabase.storage.from_(bucket).download(file_path)
        return json.loads(result)
    except Exception as e:
        logger.warning(f"Could not load metadata for {model_type}: {e}")
        return None


def predict_with_xgboost(
    model: xgb.XGBRegressor,
    features: np.ndarray,
    horizon: int = 7
) -> List[Dict[str, Any]]:
    predictions = []
    
    for i in range(horizon):
        pred = model.predict(features)
        pred_value = float(max(0, pred[0]))
        
        std = features[0][4] if features[0][4] > 0 else features[0][2] * 0.2
        
        predictions.append({
            "predicted_qty": int(round(pred_value)),
            "confidence_lower": int(round(max(0, pred_value - 1.645 * std))),
            "confidence_upper": int(round(pred_value + 1.645 * std)),
        })
    
    return predictions


def fallback_prediction(features: Dict[str, Any], horizon: int = 7) -> List[Dict[str, Any]]:
    base_qty = features.get("rolling_avg_7d", features.get("lag_1d", 0))
    
    if base_qty == 0:
        base_qty = features.get("lag_1d", 10)
    
    predictions = []
    for i in range(horizon):
        factor = 1.0 + (0.1 if i >= 5 else 0)
        qty = base_qty * factor
        
        predictions.append({
            "predicted_qty": int(round(qty)),
            "confidence_lower": int(round(qty * 0.7)),
            "confidence_upper": int(round(qty * 1.3)),
        })
    
    return predictions


def generate_forecast(
    product_id: str,
    model_type: str = "xgboost",
    horizon: int = 7
) -> Dict[str, Any]:
    logger.info(f"Generating {model_type} forecast for product: {product_id}")
    
    supabase = get_supabase_client()
    
    features = get_latest_features(supabase, product_id)
    
    if not features:
        logger.warning(f"No features found for {product_id}, using history fallback")
        history = get_demand_history(supabase, product_id)
        
        if history.empty:
            return {
                "status": "error",
                "message": "No data available for prediction",
                "product_id": product_id
            }
        
        rolling_mean = history["net_quantity"].tail(7).mean()
        base_qty = rolling_mean if rolling_mean > 0 else 10
        
        predictions = []
        for i in range(1, horizon + 1):
            pred_date = datetime.now() + timedelta(days=i)
            predictions.append({
                "date": pred_date.strftime("%Y-%m-%d"),
                "predicted_qty": int(round(base_qty)),
                "confidence_lower": int(round(base_qty * 0.7)),
                "confidence_upper": int(round(base_qty * 1.3)),
            })
        
        return {
            "status": "success",
            "product_id": product_id,
            "model_type": "fallback",
            "forecast": predictions,
            "trend": "stable",
            "generated_at": datetime.now().isoformat()
        }
    
    metadata = load_model_metadata(supabase, model_type)
    
    if model_type == "xgboost":
        model = load_xgboost_model(supabase)
        
        if model is None:
            predictions = fallback_prediction(features, horizon)
        else:
            predictions = []
            for i in range(1, horizon + 1):
                forecast_date = datetime.now() + timedelta(days=i)
                feat_vector = prepare_features_for_prediction(features, forecast_date)
                pred_list = predict_with_xgboost(model, feat_vector, 1)
                predictions.append({
                    "date": forecast_date.strftime("%Y-%m-%d"),
                    **pred_list[0]
                })
    else:
        predictions = fallback_prediction(features, horizon)
    
    base_qty = features.get("rolling_avg_7d", features.get("lag_1d", 0))
    recent_qty = features.get("lag_1d", 0)
    
    if recent_qty > base_qty * 1.2:
        trend = "rising"
    elif recent_qty < base_qty * 0.8:
        trend = "falling"
    else:
        trend = "stable"
    
    formatted_forecast = []
    for i, pred in enumerate(predictions):
        forecast_date = datetime.now() + timedelta(days=i + 1)
        formatted_forecast.append({
            "date": forecast_date.strftime("%Y-%m-%d"),
            "predicted_qty": pred["predicted_qty"],
            "confidence_lower": pred["confidence_lower"],
            "confidence_upper": pred["confidence_upper"],
        })
    
    return {
        "status": "success",
        "product_id": product_id,
        "model_type": model_type,
        "forecast": formatted_forecast,
        "trend": trend,
        "generated_at": datetime.now().isoformat(),
        "version": metadata.get("version") if metadata else "unknown"
    }


def save_forecast_to_db(supabase, product_id: str, forecast: List[Dict], warehouse_id: str = None):
    records = []
    warehouse_id = warehouse_id or "a1000000-0000-0000-0000-000000000001"
    
    for pred in forecast:
        records.append({
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "forecast_date": pred["date"],
            "predicted_qty": pred["predicted_qty"],
            "confidence_lower": pred["confidence_lower"],
            "confidence_upper": pred["confidence_upper"],
        })
    
    try:
        supabase.table("demand_forecasts").upsert(
            records,
            on_conflict="product_id,warehouse_id,forecast_date"
        ).execute()
        logger.info(f"Saved {len(records)} forecasts to database")
    except Exception as e:
        logger.warning(f"Could not save forecasts to DB: {e}")


def run_inference(product_id: str, model_type: str = "xgboost", save: bool = True):
    forecast = generate_forecast(product_id, model_type)
    
    if forecast.get("status") == "success" and save:
        supabase = get_supabase_client()
        save_forecast_to_db(supabase, product_id, forecast.get("forecast", []))
    
    return forecast


if __name__ == "__main__":
    import sys
    from pathlib import Path
    
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    
    if len(sys.argv) < 2:
        print("Usage: python inference.py <product_id> [xgboost|tft]")
        sys.exit(1)
    
    product_id = sys.argv[1]
    model_type = sys.argv[2] if len(sys.argv) > 2 else "xgboost"
    
    result = run_inference(product_id, model_type)
    
    print(json.dumps(result, indent=2))