import os
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MIN_HISTORY_DAYS = 14
FORECAST_HORIZON_DAYS = 30
MODEL_VERSION = "v2_tft_transfer"

DEFAULT_WAREHOUSE = "a1000000-0000-0000-0000-000000000001"

MIN_DATA_THRESHOLD = 10000

L2_WEIGHT_DECAY = 0.1

INDIAN_HOLIDAYS = [
    {"name": "Diwali", "date": "2024-11-01"},
    {"name": "Diwali", "date": "2025-10-20"},
    {"name": "Holi", "date": "2024-03-25"},
    {"name": "Holi", "date": "2025-03-14"},
    {"name": "Ganesh Chaturthi", "date": "2024-09-07"},
    {"name": "Ganesh Chaturthi", "date": "2025-08-25"},
    {"name": "Durga Puja", "date": "2024-10-09"},
    {"name": "Durga Puja", "date": "2025-09-28"},
    {"name": "Navratri", "date": "2024-10-03"},
    {"name": "Navratri", "date": "2025-09-22"},
    {"name": "Independence Day", "date": "2024-08-15"},
    {"name": "Independence Day", "date": "2025-08-15"},
    {"name": "Republic Day", "date": "2024-01-26"},
    {"name": "Republic Day", "date": "2025-01-26"},
    {"name": "Gandhi Jayanti", "date": "2024-10-02"},
    {"name": "Gandhi Jayanti", "date": "2025-10-02"},
    {"name": "Janmashtami", "date": "2024-08-26"},
    {"name": "Janmashtami", "date": "2025-08-16"},
    {"name": "Mahashivratri", "date": "2024-03-08"},
    {"name": "Mahashivratri", "date": "2025-02-26"},
    {"name": "Raksha Bandhan", "date": "2024-08-09"},
    {"name": "Raksha Bandhan", "date": "2025-07-30"},
]

try:
    from darts import TimeSeries
    from darts.models import TFTModel
    from darts.utils.losses import QuantileLoss
    from darts.dataprocessing.transformers import Scaler
    from darts.dataprocessing import Dado
    DARTS_AVAILABLE = True
except ImportError as e:
    DARTS_AVAILABLE = False
    logger.warning(f"WARNING: darts not available - {e}")


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_stock_movements(supabase, product_id: str, warehouse_id: Optional[str] = None):
    wh_id = warehouse_id or DEFAULT_WAREHOUSE
    logger.info(f"[DEBUG] Using warehouse_id: {wh_id}")
    
    query = supabase.table("stock_movements").select(
        "date, quantity, type, product_id, warehouse_id"
    ).eq("product_id", product_id).order("date").limit(10000)

    if warehouse_id:
        query = query.eq("warehouse_id", warehouse_id)

    result = query.execute()
    df = pd.DataFrame(result.data if result.data else [])
    
    if df.empty:
        logger.warning(f"[DEBUG] No data found for product_id={product_id}")
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"])
    return df


def get_all_product_data() -> Tuple[pd.DataFrame, int]:
    supabase = get_supabase_client()
    
    result = supabase.table("stock_movements").select(
        "date, quantity, product_id, warehouse_id"
    ).order("date").limit(50000).execute()
    
    df = pd.DataFrame(result.data if result.data else [])
    total_rows = len(df)
    
    logger.info(f"[Data Pipeline] Loaded {total_rows} rows from stock_movements")
    return df, total_rows


def fill_missing_dates(df: pd.DataFrame, date_col: str = "date", value_col: str = "y") -> pd.DataFrame:
    if df.empty or date_col not in df.columns:
        return df
    
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    
    df_agg = df.groupby(date_col).agg(
        **{value_col: (value_col if value_col in df.columns else "quantity", "sum")}
    ).reset_index()
    
    if value_col not in df_agg.columns:
        df_agg[value_col] = 0
    
    start_date = df_agg[date_col].min()
    end_date = pd.Timestamp.now().normalize()
    
    all_dates = pd.date_range(start=start_date, end=end_date, freq="D")
    full_df = pd.DataFrame({date_col: all_dates})
    full_df = full_df.merge(df_agg, on=date_col, how="left")
    full_df[value_col] = full_df[value_col].fillna(0)
    
    logger.info(f"[Data Pipeline] Filled {full_df[value_col].isna().sum()} missing dates with 0")
    return full_df.reset_index(drop=True)


def create_holiday_covariates(start_date: datetime, end_date: datetime) -> pd.DataFrame:
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    holiday_df = pd.DataFrame({"date": dates})
    
    holiday_dates = set()
    for h in INDIAN_HOLIDAYS:
        try:
            holiday_date = pd.to_datetime(h["date"])
            if start_date <= holiday_date <= end_date:
                holiday_dates.add(holiday_date)
        except:
            pass
    
    for holiday in INDIAN_HOLIDAYS:
        holiday_name = holiday["name"]
        try:
            h_date = pd.to_datetime(holiday["date"])
            if start_date <= h_date <= end_date:
                col_name = f"holiday_{holiday_name.replace(' ', '_').lower()}"
                holiday_df[col_name] = 0
                holiday_df.loc[holiday_df["date"] == h_date, col_name] = 1
        except:
            pass
    
    if "holiday_flags" not in holiday_df.columns:
        holiday_df["holiday_flags"] = holiday_df["date"].apply(lambda x: 1 if x in holiday_dates else 0)
    
    logger.info(f"[Covariates] Created holiday features for {len(dates)} days")
    return holiday_df


def create_time_covariates(start_date: datetime, end_date: datetime) -> pd.DataFrame:
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    df = pd.DataFrame({"date": dates})
    
    df["day_of_week"] = dates.dayofweek
    df["day_of_month"] = dates.day
    df["month"] = dates.month
    df["week_of_year"] = dates.isocalendar().week
    df["is_weekend"] = (dates.dayofweek >= 5).astype(int)
    df["quarter"] = dates.quarter
    
    df["sin_day_of_year"] = np.sin(2 * np.pi * dates.dayofyear / 365)
    df["cos_day_of_year"] = np.cos(2 * np.pi * dates.dayofyear / 365)
    df["sin_month"] = np.sin(2 * np.pi * dates.month / 12)
    df["cos_month"] = np.cos(2 * np.pi * dates.month / 12)
    
    return df


def get_training_data(product_id: str, warehouse_id: Optional[str] = None) -> pd.DataFrame:
    supabase = get_supabase_client()
    movements = get_stock_movements(supabase, product_id, warehouse_id)

    if movements.empty:
        return pd.DataFrame(columns=["ds", "y"])

    movements["date"] = pd.to_datetime(movements["date"])

    daily_volume = movements.groupby("date").agg(
        y=("quantity", "sum")
    ).reset_index()
    daily_volume.columns = ["ds", "y"]
    daily_volume["ds"] = pd.to_datetime(daily_volume["ds"])
    daily_volume = daily_volume.drop_duplicates(subset=["ds"]).sort_values("ds").reset_index(drop=True)

    end_date = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=daily_volume["ds"].min(), end=end_date, freq="D")
    full_df = pd.DataFrame({"ds": all_dates})
    full_df = full_df.merge(daily_volume, on="ds", how="left")
    full_df["y"] = full_df["y"].fillna(0)
    full_df = full_df.reset_index(drop=True)

    return full_df


def check_data_sufficiency() -> Tuple[bool, int]:
    _, total_rows = get_all_product_data()
    is_sufficient = total_rows >= MIN_DATA_THRESHOLD
    
    if not is_sufficient:
        logger.warning(
            f"INSUFFICIENT DATA FOR FULL TFT TRAINING. RUNNING IN ZERO-SHOT FALLBACK MODE. "
            f"Total rows: {total_rows} < {MIN_DATA_THRESHOLD}"
        )
    
    return is_sufficient, total_rows


def create_tft_model(lightweight: bool = False) -> 'TFTModel':
    if not DARTS_AVAILABLE:
        raise ImportError("darts library not available")
    
    quantiles = [0.10, 0.50, 0.90]
    
    if lightweight:
        model = TFTModel(
            input_chunk_length=7,
            output_chunk_length=FORECAST_HORIZON_DAYS,
            hidden_size=16,
            dropout=L2_WEIGHT_DECAY,
            num_attention_heads=2,
            num_lstm_layers=1,
            loss_fn=QuantileLoss(quantiles=quantiles),
            weight_decay=L2_WEIGHT_DECAY,
            lr=0.01,
            random_state=42,
            export_multivariate=False,
        )
    else:
        model = TFTModel(
            input_chunk_length=14,
            output_chunk_length=FORECAST_HORIZON_DAYS,
            hidden_size=64,
            dropout=L2_WEIGHT_DECAY,
            num_attention_heads=4,
            num_lstm_layers=2,
            loss_fn=QuantileLoss(quantiles=quantiles),
            weight_decay=L2_WEIGHT_DECAY,
            lr=0.001,
            random_state=42,
            export_multivariate=False,
        )
    
    logger.info(f"[TFT] Created model with weight_decay={L2_WEIGHT_DECAY}")
    return model


def prepare_darts_series(
    df: pd.DataFrame,
    time_col: str = "ds",
    value_col: str = "y",
    static covariates: Optional[dict] = None
) -> 'TimeSeries':
    if df.empty or len(df) < 7:
        raise ValueError("Insufficient data for TimeSeries creation")
    
    df_clean = df.copy()
    df_clean[time_col] = pd.to_datetime(df_clean[time_col])
    df_clean = df_clean.set_index(time_col).sort_index()
    
    ts = TimeSeries.from_dataframe(df_clean, value_cols=[value_col])
    
    logger.info(f"[Darts] Created TimeSeries with {len(ts)} points")
    return ts


def prepare_covariates(
    df: pd.DataFrame,
    start_date: datetime,
    end_date: datetime
) -> 'TimeSeries':
    time_cov = create_time_covariates(start_date, end_date)
    holiday_cov = create_holiday_covariates(start_date, end_date)
    
    merged = time_cov.merge(holiday_cov, on="date", how="left")
    merged = merged.set_index("date")
    
    for col in merged.columns:
        if merged[col].dtype in ['int64', 'float64']:
            merged[col] = merged[col].astype(float)
    
    ts = TimeSeries.from_dataframe(merged)
    
    logger.info(f"[Covariates] Prepared {len(ts)} covariate points")
    return ts


def train_tft_model(
    timeseries: 'TimeSeries',
    covariates: Optional['TimeSeries'] = None,
    is_sparse: bool = False
) -> 'TFTModel':
    is_sufficient, total_rows = check_data_sufficiency()
    
    use_lightweight = not is_sufficient or is_sparse
    
    model = create_tft_model(lightweight=use_lightweight)
    
    logger.info(f"[TFT] Training with {'lightweight' if use_lightweight else 'full'} config")
    logger.info(f"[TFT] Total training samples available: {total_rows}")
    
    try:
        if covariates is not None:
            model.fit(
                timeseries,
                future_covariates=covariates,
                verbose=False
            )
        else:
            model.fit(timeseries, verbose=False)
        
        logger.info("[TFT] Training completed successfully")
    except Exception as e:
        logger.error(f"[TFT] Training failed: {e}")
        raise
    
    return model


def predict_with_tft(
    model: 'TFTModel',
    timeseries: 'TimeSeries',
    covariates: Optional['TimeSeries'] = None,
    horizon: int = FORECAST_HORIZON_DAYS
) -> dict:
    try:
        if covariates is not None:
           pred = model.predict(
                n=horizon,
                series=timeseries,
                future_covariates=covariates
            )
        else:
            pred = model.predict(n=horizon, series=timeseries)
        
        p50_values = pred.values(axis=1)[:, 0] if pred.width > 0 else pred.values.flatten()
        p90_values = p50_values
        p10_values = p50_values
        
        if pred.width >= 3:
            p10_values = pred.values(axis=1)[:, 0]
            p50_values = pred.values(axis=1)[:, 1]
            p90_values = pred.values(axis=1)[:, 2]
        
        pred_dates = pred.time_index
        
        predictions = []
        for i, dt in enumerate(pred_dates):
            p50 = float(p50_values[i]) if i < len(p50_values) else 0.0
            p90 = float(p90_values[i]) if i < len(p90_values) else p50
            p10 = float(p10_values[i]) if i < len(p10_values) else p50
            
            predictions.append({
                "forecast_date": str(dt.date()),
                "predicted_qty": max(0, int(round(p50))),
                "confidence_lower": max(0, int(round(p10))),
                "confidence_upper": max(0, int(round(p90))),
            })
        
        logger.info(f"[TFT] Generated {len(predictions)} predictions")
        return {
            "status": "success",
            "predictions": predictions,
            "p50": p50_values.tolist(),
            "p90": p90_values.tolist(),
            "p10": p10_values.tolist(),
        }
        
    except Exception as e:
        logger.error(f"[TFT] Prediction failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "predictions": [],
        }


def calculate_metrics(df: pd.DataFrame, predictions: np.ndarray) -> dict:
    if len(df) < 7 or len(predictions) == 0:
        return {"mape": None, "rmse": None, "mae": None}

    y_true = df["y"].values[-len(predictions):]
    y_pred = predictions[:len(y_true)]
    
    mask = y_true > 1.0
    if np.sum(mask) < 3:
        return {"mape": None, "rmse": None, "mae": None}
    
    y_true_filtered = y_true[mask]
    y_pred_filtered = y_pred[mask]
    
    mape = np.mean(np.abs((y_true_filtered - y_pred_filtered) / y_true_filtered)) * 100
    mape = min(mape, 999.99)
    
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
    mae = np.mean(np.abs(y_true - y_pred))
    
    return {
        "mape": round(mape, 4),
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
    }


def save_forecasts(product_id: str, warehouse_id: Optional[str], predictions: list):
    supabase = get_supabase_client()
    wh_id = warehouse_id or DEFAULT_WAREHOUSE

    records = []
    for pred in predictions:
        records.append({
            "product_id": product_id.strip(),
            "warehouse_id": wh_id,
            "forecast_date": pred["forecast_date"],
            "predicted_qty": pred["predicted_qty"],
            "confidence_lower": pred["confidence_lower"],
            "confidence_upper": pred["confidence_upper"],
        })

    supabase.table("demand_forecasts").upsert(records, on_conflict="product_id,warehouse_id,forecast_date").execute()
    logger.info(f"[DB] Upserted {len(predictions)} forecasts to demand_forecasts")


def save_metrics(
    product_id: str,
    warehouse_id: Optional[str],
    metrics: dict,
    sample_size: int,
    training_start: str,
    training_end: str
):
    supabase = get_supabase_client()
    
    mape_value = metrics.get("mape")
    if mape_value and mape_value > 999:
        mape_value = 999.99

    supabase.table("model_metrics").upsert({
        "product_id": product_id,
        "warehouse_id": warehouse_id or DEFAULT_WAREHOUSE,
        "model_version": MODEL_VERSION,
        "mape": mape_value,
        "rmse": metrics.get("rmse"),
        "mae": metrics.get("mae"),
        "sample_size": sample_size,
        "forecast_horizon": FORECAST_HORIZON_DAYS,
        "training_start_date": training_start,
        "training_end_date": training_end,
    }, on_conflict="product_id,warehouse_id,model_version").execute()
    logger.info(f"[DB] Upserted metrics to model_metrics: MAPE={mape_value}")


def generate_forecast(
    product_id: str,
    warehouse_id: Optional[str] = None,
    horizon: int = FORECAST_HORIZON_DAYS
) -> dict:
    if not DARTS_AVAILABLE:
        logger.warning("[TFT] darts not available, using fallback mode")
        return generate_forecast_fallback(product_id, warehouse_id, horizon)
    
    df = get_training_data(product_id, warehouse_id)
    
    if df.empty or len(df) < MIN_HISTORY_DAYS:
        return {
            "status": "insufficient_data",
            "message": f"Need at least {MIN_HISTORY_DAYS} days of history",
            "product_id": product_id,
            "days_available": len(df) if not df.empty else 0,
        }
    
    df = df.drop_duplicates(subset=["ds"], keep="last").reset_index(drop=True)
    
    ts = prepare_darts_series(df, time_col="ds", value_col="y")
    
    start_date = df["ds"].min()
    end_date = df["ds"].max()
    future_end = end_date + timedelta(days=horizon)
    
    cov_ts = prepare_covariates(start_date, end_date)
    future_dates = pd.date_range(start=end_date + timedelta(days=1), end=future_end, freq="D")
    future_cov = create_holiday_covariates(start_date, future_end)
    future_time_cov = create_time_covariates(start_date, future_end)
    future_merged = future_time_cov.merge(future_cov, on="date", how="left").set_index("date")
    
    for col in future_merged.columns:
        if future_merged[col].dtype in ['int64', 'float64']:
            future_merged[col] = future_merged[col].astype(float)
    
    future_cov_ts = TimeSeries.from_dataframe(future_merged)
    
    is_sufficient, total_rows = check_data_sufficiency()
    
    try:
        model = train_tft_model(ts, cov_ts, is_sparse=not is_sufficient)
        
        result = predict_with_tft(model, ts, future_cov_ts, horizon)
        
        if result["status"] == "success":
            predictions = result["predictions"]
            
            save_forecasts(product_id, warehouse_id, predictions)
            
            training_start = df["ds"].min().strftime("%Y-%m-%d")
            training_end = df["ds"].max().strftime("%Y-%m-%d")
            
            metrics = calculate_metrics(df, np.array(result.get("p50", [])))
            
            logger.info(f"\n=== Training Metrics ===")
            logger.info(f"RMSE: {metrics.get('rmse', 'N/A')}")
            logger.info(f"MAE: {metrics.get('mae', 'N/A')}")
            logger.info(f"MAPE: {metrics.get('mape', 'N/A')}%")
            
            save_metrics(product_id, warehouse_id, metrics, len(df), training_start, training_end)
            
            return {
                "status": "success",
                "product_id": product_id,
                "warehouse_id": warehouse_id,
                "predictions": predictions,
                "metrics": metrics,
                "training_days": len(df),
                "horizon_days": horizon,
                "zero_shot_mode": not is_sufficient,
            }
        else:
            return result
            
    except Exception as e:
        logger.error(f"[TFT] Error in TFT pipeline: {e}")
        return generate_forecast_fallback(product_id, warehouse_id, horizon)


def generate_forecast_fallback(
    product_id: str,
    warehouse_id: Optional[str] = None,
    horizon: int = FORECAST_HORIZON_DAYS
) -> dict:
    df = get_training_data(product_id, warehouse_id)
    
    if df.empty:
        return {
            "status": "insufficient_data",
            "message": "No data available",
            "product_id": product_id,
        }
    
    df = df.drop_duplicates(subset=["ds"], keep="last").reset_index(drop=True)
    
    recent_mean = df["y"].tail(14).mean() if len(df) >= 14 else df["y"].mean()
    recent_std = df["y"].tail(14).std() if len(df) >= 14 else df["y"].std()
    
    last_date = df["ds"].max()
    
    predictions = []
    for i in range(1, horizon + 1):
        pred_date = last_date + timedelta(days=i)
        
        base_qty = max(0, recent_mean)
        
        p50 = int(round(base_qty))
        p90 = int(round(base_qty + 1.645 * recent_std))
        p10 = int(round(max(0, base_qty - 1.645 * recent_std)))
        
        if p90 < p50:
            p90 = p50 + max(1, int(recent_std))
        if p10 > p50:
            p10 = max(0, p50 - max(1, int(recent_std * 0.5)))
        
        predictions.append({
            "forecast_date": str(pred_date.date()),
            "predicted_qty": p50,
            "confidence_lower": p10,
            "confidence_upper": p90,
        })
    
    save_forecasts(product_id, warehouse_id, predictions)
    
    training_start = df["ds"].min().strftime("%Y-%m-%d")
    training_end = df["ds"].max().strftime("%Y-%m-%d")
    
    metrics = calculate_metrics(df, np.array([p["predicted_qty"] for p in predictions]))
    
    logger.info(f"\n=== Fallback Mode Metrics ===")
    logger.info(f"RMSE: {metrics.get('rmse', 'N/A')}")
    logger.info(f"MAE: {metrics.get('mae', 'N/A')}")
    logger.info(f"MAPE: {metrics.get('mape', 'N/A')}%")
    
    save_metrics(product_id, warehouse_id, metrics, len(df), training_start, training_end)
    
    return {
        "status": "success_fallback",
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "predictions": predictions,
        "metrics": metrics,
        "training_days": len(df),
        "horizon_days": horizon,
        "fallback_mode": True,
    }


async def run_async_forecast(
    product_id: str,
    warehouse_id: Optional[str] = None
) -> dict:
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        None,
        generate_forecast,
        product_id,
        warehouse_id,
        FORECAST_HORIZON_DAYS
    )
    
    return result


def run_forecaster(product_id: str, warehouse_id: Optional[str] = None):
    logger.info(f"[Forecaster] Starting TFT forecast for product: {product_id}")
    
    result = asyncio.run(run_async_forecast(product_id, warehouse_id))

    if result.get("status") == "success":
        logger.info(f"[Forecaster] Success - Generated {len(result['predictions'])} predictions")
        if result.get("metrics", {}).get("mape"):
            logger.info(f"[Forecaster] MAPE: {result['metrics']['mape']:.2f}%")
            logger.info(f"[Forecaster] RMSE: {result['metrics']['rmse']:.2f}")
        
        if result.get("zero_shot_mode"):
            logger.warning("[Forecaster] Running in ZERO-SHOT FALLBACK MODE due to insufficient data")
        
        sorted_preds = sorted(result["predictions"], key=lambda x: x["predicted_qty"], reverse=True)[:5]
        logger.info(f"\n=== Top 5 Predicted Days of Demand ===")
        for i, pred in enumerate(sorted_preds, 1):
            logger.info(f"  {i}. {pred['forecast_date']}: {pred['predicted_qty']} units (range: {pred['confidence_lower']}-{pred['confidence_upper']})")
    else:
        logger.warning(f"[Forecaster] Status: {result.get('status')} - {result.get('message', 'N/A')}")

    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python demand_forecaster.py <product_id> [warehouse_id]")
        sys.exit(1)

    product_id = sys.argv[1]
    warehouse_id = sys.argv[2] if len(sys.argv) > 2 else None

    run_forecaster(product_id, warehouse_id)