import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
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
MODEL_VERSION = f"v1_{datetime.now().strftime('%Y_%m_%d')}"

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

try:
    from pytorch_forecasting.data import TimeSeriesDataSet
    from pytorch_forecasting.models import TemporalFusionTransformer
    from pytorch_forecasting.metrics import QuantileLoss
    import torch
    TFT_AVAILABLE = True
except ImportError as e:
    TFT_AVAILABLE = False
    logger.warning(f"TFT not available: {e}")


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def load_demand_data(supabase, days_back: int = 90) -> pd.DataFrame:
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    result = supabase.table("daily_demand_timeseries").select(
        "product_id, product_name, category, date, net_quantity"
    ).gte("date", start_date).execute()
    
    df = pd.DataFrame(result.data if result.data else [])
    
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values(["product_id", "date"])
    
    logger.info(f"Loaded {len(df)} rows from daily_demand_timeseries")
    return df


def is_holiday(date: datetime) -> Tuple[bool, Optional[str]]:
    for holiday in INDIAN_HOLIDAYS:
        if date.month == holiday["month"] and date.day == holiday["day"]:
            return True, holiday["name"]
    return False, None


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["product_id", "date"])
    
    df = df.groupby("product_id", group_keys=False).apply(_add_lag_features).reset_index(drop=True)
    df = df.dropna(subset=["lag_1d"])
    
    return df


def _add_lag_features(group: pd.DataFrame) -> pd.DataFrame:
    group = group.sort_values("date")
    group["lag_1d"] = group["net_quantity"].shift(1).fillna(0)
    group["lag_7d"] = group["net_quantity"].shift(7).fillna(0)
    group["rolling_mean_7d"] = group["net_quantity"].rolling(7, min_periods=1).mean().shift(1).fillna(0)
    group["rolling_mean_14d"] = group["net_quantity"].rolling(14, min_periods=1).mean().shift(1).fillna(0)
    group["rolling_std_7d"] = group["net_quantity"].rolling(7, min_periods=1).std().shift(1).fillna(0)
    
    group["day_of_week"] = group["date"].dt.dayofweek
    group["is_weekend"] = (group["day_of_week"] >= 5).astype(int)
    group["is_month_start"] = (group["date"].dt.day <= 5).astype(int)
    group["is_month_end"] = (group["date"].dt.day >= 25).astype(int)
    
    holiday_names = []
    for _, row in group.iterrows():
        _, name = is_holiday(row["date"])
        holiday_names.append(1 if name else 0)
    group["is_holiday"] = holiday_names
    
    return group


def train_xgboost(df: pd.DataFrame) -> xgb.XGBRegressor:
    feature_cols = [
        "lag_1d", "lag_7d", "rolling_mean_7d", "rolling_mean_14d", "rolling_std_7d",
        "day_of_week", "is_weekend", "is_month_start", "is_month_end", "is_holiday"
    ]
    
    df_train = df.dropna(subset=feature_cols + ["net_quantity"])
    
    if len(df_train) < 100:
        logger.warning("Insufficient data for XGBoost training, using simple fallback")
        return None
    
    X = df_train[feature_cols].values
    y = df_train["net_quantity"].values
    
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        objective="reg:squarederror"
    )
    
    logger.info(f"Training XGBoost on {len(X)} samples...")
    model.fit(X, y)
    
    logger.info(f"XGBoost training complete. Feature importance:")
    for name, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        logger.info(f"  {name}: {imp:.4f}")
    
    return model


def prepare_tft_dataset(df: pd.DataFrame) -> TimeSeriesDataSet:
    df = df.copy()
    df["time_idx"] = (df["date"] - df["date"].min()).dt.days
    df["group"] = df["product_id"]
    
    max_time = df["time_idx"].max()
    
    training_cutoff = int(max_time * 0.8)
    
    feature_cols = [
        "lag_1d", "lag_7d", "rolling_mean_7d",
        "day_of_week", "is_weekend", "is_holiday"
    ]
    
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0
    
    df = df.dropna(subset=feature_cols + ["net_quantity"])
    
    if len(df) < 200:
        raise ValueError(f"Insufficient data for TFT: {len(df)} rows")
    
    ds = TimeSeriesDataSet(
        df,
        time_idx="time_idx",
        target="net_quantity",
        group_ids=["group"],
        max_encoder_length=14,
        max_prediction_length=7,
        static_categoricals=["category"],
        time_varying_known_reals=feature_cols,
        training_cutoff=training_cutoff,
    )
    
    return ds


def train_tft(ds: TimeSeriesDataSet) -> TemporalFusionTransformer:
    train_dataloader = ds.to_dataloader(train=True, batch_size=64, num_workers=0)
    
    model = TemporalFusionTransformer(
        dataset=ds,
        loss_fn=QuantileLoss([0.1, 0.5, 0.9]),
        learning_rate=0.01,
        reduce_on_plateau_patience=3,
        reduce_on_plateau_reduction=2,
        optimizer="ranger",
    )
    
    logger.info("Training TFT...")
    model.fit(train_dataloader, max_epochs=10)
    
    return model


def upload_model(supabase, model_type: str, model, metadata: dict):
    bucket = "ml-models"
    
    model_data = json.dumps(metadata)
    if model_type == "xgboost":
        model_data = model.save_raw()
    
    file_path = f"{model_type}/{MODEL_VERSION}/model.bin"
    
    try:
        supabase.storage.from_(bucket).upload(
            file_path,
            model_data,
            {"content-type": "application/octet-stream", "upsert": True}
        )
        logger.info(f"Uploaded {model_type} model to {bucket}/{file_path}")
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")


def upload_model_metadata(supabase, model_type: str, metrics: dict):
    metadata = {
        "model_type": model_type,
        "version": MODEL_VERSION,
        "trained_at": datetime.now().isoformat(),
        **metrics
    }
    
    bucket = "ml-models"
    file_path = f"{model_type}/{MODEL_VERSION}/metadata.json"
    
    try:
        supabase.storage.from_(bucket).upload(
            file_path,
            json.dumps(metadata),
            {"content-type": "application/json", "upsert": True}
        )
        logger.info(f"Uploaded metadata to {bucket}/{file_path}")
    except Exception as e:
        logger.error(f"Failed to upload metadata: {e}")


def save_training_results(supabase, results: dict):
    result_data = {
        "model_type": results.get("model_type"),
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now().isoformat(),
        "sample_size": results.get("sample_size", 0),
        "metrics": results.get("metrics", {}),
    }
    
    try:
        supabase.table("model_training_logs").insert(result_data).execute()
        logger.info("Saved training results to model_training_logs")
    except Exception as e:
        logger.warning(f"Could not save to model_training_logs: {e}")


def train_all_models():
    logger.info("=" * 50)
    logger.info(f"Starting training - Version: {MODEL_VERSION}")
    logger.info("=" * 50)
    
    supabase = get_supabase_client()
    
    df = load_demand_data(supabase, days_back=90)
    
    if df.empty:
        logger.error("No data available for training")
        return
    
    df_features = create_features(df)
    
    if df_features.empty:
        logger.error("No features created")
        return
    
    sample_size = len(df_features)
    logger.info(f"Training data prepared: {sample_size} samples")
    
    results = {"sample_size": sample_size, "model_type": "hybrid"}
    
    # Train XGBoost
    try:
        xgb_model = train_xgboost(df_features)
        
        if xgb_model:
            upload_model(supabase, "xgboost", xgb_model, {"sample_size": sample_size})
            results["xgboost"] = {"status": "success"}
            logger.info("XGBoost training complete")
        else:
            results["xgboost"] = {"status": "fallback"}
    except Exception as e:
        logger.error(f"XGBoost training failed: {e}")
        results["xgboost"] = {"status": "failed", "error": str(e)}
    
    # Train TFT if available
    if TFT_AVAILABLE:
        try:
            tft_ds = prepare_tft_dataset(df_features)
            tft_model = train_tft(tft_ds)
            
            upload_model(supabase, "tft", tft_model, {"sample_size": sample_size})
            results["tft"] = {"status": "success"}
            logger.info("TFT training complete")
        except Exception as e:
            logger.error(f"TFT training failed: {e}")
            results["tft"] = {"status": "failed", "error": str(e)}
    else:
        logger.info("TFT not available, skipping...")
        results["tft"] = {"status": "not_available"}
    
    save_training_results(supabase, results)
    
    logger.info("=" * 50)
    logger.info("Training complete!")
    logger.info(f"Results: {json.dumps(results, indent=2)}")
    logger.info("=" * 50)
    
    return results


if __name__ == "__main__":
    import sys
    from pathlib import Path
    
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    
    train_all_models()