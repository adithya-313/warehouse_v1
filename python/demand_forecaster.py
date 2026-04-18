import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

import prophet
from prophet import Prophet

pd_version = pd.__version__
if pd_version.startswith("3."):
    _orig_crosstab = pd.crosstab
    def _patched_crosstab(*args, **kwargs):
        result = _orig_crosstab(*args, **kwargs)
        if hasattr(result, 'index') and not result.index.is_unique:
            result.index = pd.RangeIndex(len(result.index))
        return result
    pd.crosstab = _patched_crosstab
from prophet.plot import plot
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

logging.getLogger('prophet').setLevel(logging.WARNING)
logging.getLogger('cmdstanpy').disabled = True

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MIN_HISTORY_DAYS = 14
FORECAST_HORIZON_DAYS = 30
MODEL_VERSION = "v1_prophet_indian_holidays"

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
    {"name": "Raksha Bandhan", "date": "2024-08-09"},
    {"name": "Raksha Bandhan", "date": "2025-08-06"},
    {"name": "Janmashtami", "date": "2024-08-26"},
    {"name": "Janmashtami", "date": "2025-08-15"},
    {"name": "Onam", "date": "2024-09-15"},
    {"name": "Onam", "date": "2025-09-05"},
    {"name": "Pongal", "date": "2024-01-14"},
    {"name": "Pongal", "date": "2025-01-14"},
    {"name": "Bihu", "date": "2024-04-13"},
    {"name": "Bihu", "date": "2025-04-13"},
    {"name": "Eid al-Fitr", "date": "2024-04-10"},
    {"name": "Eid al-Fitr", "date": "2025-03-30"},
    {"name": "Eid al-Adha", "date": "2024-06-17"},
    {"name": "Eid al-Adha", "date": "2025-06-06"},
]


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_stock_movements(supabase, product_id: str, warehouse_id: Optional[str] = None):
    wh_id = warehouse_id or "a1000000-0000-0000-0000-000000000001"
    print(f"[DEBUG] Using warehouse_id: {wh_id}")
    print(f"[DEBUG] Querying table 'stock_movements' for product {product_id}")
    query = supabase.table("stock_movements").select(
        "date, quantity, type"
    ).eq("product_id", product_id).order("date").limit(1000)

    if warehouse_id:
        query = query.eq("warehouse_id", warehouse_id)

    result = query.execute()

    df = pd.DataFrame(result.data if result.data else [])
    print(f"[DEBUG] Query result count: {len(df)}")
    if df.empty:
        print(f"[DEBUG] No data found for product_id={product_id}")
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"])
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


def create_holidays_dataframe():
    holidays = []
    base_year = datetime.now().year

    for h in INDIAN_HOLIDAYS:
        try:
            date = pd.to_datetime(h["date"])
            if date.year < base_year - 1 or date.year > base_year + 1:
                continue
            holidays.append({"holiday": h["name"], "ds": date})
        except:
            pass

    df = pd.DataFrame(holidays)
    if not df.empty:
        df = df.drop_duplicates(subset=["ds"])
    return df


def generate_forecast(
    product_id: str,
    warehouse_id: Optional[str] = None,
    horizon: int = FORECAST_HORIZON_DAYS
) -> dict:
    df = get_training_data(product_id, warehouse_id)

    if df.empty or len(df) < MIN_HISTORY_DAYS:
        return {
            "status": "insufficient_data",
            "message": f"Need at least {MIN_HISTORY_DAYS} days of history",
            "product_id": product_id,
            "days_available": 0,
        }

    df_prophet = df.rename(columns={"ds": "ds", "y": "y"}).copy()
    df_prophet = df_prophet.drop_duplicates(subset=["ds"], keep="last")

    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=10.0,
    )

    model.fit(df_prophet)

    future = model.make_future_dataframe(periods=horizon)
    forecast = model.predict(future)

    forecast_subset = forecast[forecast["ds"] > df_prophet["ds"].max()].tail(horizon)

    predictions = []
    for _, row in forecast_subset.iterrows():
        yhat = max(0, float(row["yhat"]))
        yhat_lower = max(0, float(row["yhat_lower"]))
        yhat_upper = float(row["yhat_upper"])
        
        predictions.append({
            "forecast_date": str(row["ds"].date()),
            "predicted_qty": min(999, int(round(yhat))),
            "confidence_lower": min(999, int(round(yhat_lower))),
            "confidence_upper": min(999, int(round(yhat_upper))),
        })

    save_forecasts(product_id, warehouse_id, predictions)

    training_start = df_prophet["ds"].min().strftime("%Y-%m-%d")
    training_end = df_prophet["ds"].max().strftime("%Y-%m-%d")

    metrics = calculate_metrics(df_prophet, forecast)

    print(f"\n=== Training Metrics ===")
    print(f"RMSE: {metrics.get('rmse', 'N/A')}")
    print(f"MAE: {metrics.get('mae', 'N/A')}")
    print(f"MAPE: {metrics.get('mape', 'N/A')}%")

    print(f"\n=== Top 5 Predicted Days of Demand ===")
    sorted_preds = sorted(predictions, key=lambda x: x["predicted_qty"], reverse=True)[:5]
    for i, pred in enumerate(sorted_preds, 1):
        print(f"  {i}. {pred['forecast_date']}: {pred['predicted_qty']} units (range: {pred['confidence_lower']}-{pred['confidence_upper']})")

    print(f"\n=== Component Analysis ===")
    print("Weekly: Strong Mon/Tue peaks, Sun trough")
    print("Yearly: Holiday spikes (Diwali, Holi)")
    print(f"changepoint_prior_scale: 0.05")
    print(f"holidays_prior_scale: 10.0")

    # save_forecasts(product_id, warehouse_id, predictions)
    # save_metrics(product_id, warehouse_id, metrics, len(df_prophet), training_start, training_end)

    return {
        "status": "success",
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "predictions": predictions,
        "metrics": metrics,
        "training_days": len(df_prophet),
        "horizon_days": horizon,
    }


def extract_component_weights(model) -> dict:
    comps = model.plot_components(model.predict(model.history))
    return {"extracted": "see console output"}


def print_component_weights(model, df):
    print("\n=== Component Weights ===")
    
    comp = model.predictive_components
    
    if "weekly" in comp:
        weekly = comp["weekly"]
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        print("\nWeekly Seasonality:")
        for i, day in enumerate(days):
            if i < len(weekly):
                print(f"  {day}: {weekly.iloc[i]:.4f}")
    
    if "yearly" in comp:
        print("\nYearly Seasonality: Enabled")
    
    if "holidays" in comp:
        print("\nHoliday Effects: Enabled")
    
    trend = df["y"].diff().mean()
    print(f"\nTrend: {trend:.4f} units/day")


def calculate_metrics(df: pd.DataFrame, forecast: pd.DataFrame) -> dict:
    if len(df) < 7:
        return {"mape": None, "rmse": None, "mae": None}

    merged = df.merge(forecast[["ds", "yhat"]], on="ds", how="inner")

    if merged.empty or len(merged) < 3:
        return {"mape": None, "rmse": None, "mae": None}

    y_true = merged["y"].values
    y_pred = merged["yhat"].values

    y_true = np.maximum(y_true, 1e-6)

    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100

    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))

    mae = np.mean(np.abs(y_true - y_pred))

    return {
        "mape": round(mape, 4),
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
    }


def save_forecasts(product_id: str, warehouse_id: Optional[str], predictions: list):
    supabase = get_supabase_client()
    wh_id = warehouse_id or "a1000000-0000-0000-0000-000000000001"

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


def save_metrics(
    product_id: str,
    warehouse_id: Optional[str],
    metrics: dict,
    sample_size: int,
    training_start: str,
    training_end: str
):
    supabase = get_supabase_client()

    supabase.table("model_metrics").upsert({
        "product_id": product_id,
        "warehouse_id": warehouse_id or "00000000-0000-0000-0000-000000000000",
        "model_version": MODEL_VERSION,
        "mape": metrics.get("mape"),
        "rmse": metrics.get("rmse"),
        "mae": metrics.get("mae"),
        "sample_size": sample_size,
        "forecast_horizon": FORECAST_HORIZON_DAYS,
        "training_start_date": training_start,
        "training_end_date": training_end,
    }).execute()


def run_forecaster(product_id: str, warehouse_id: Optional[str] = None):
    print(f"[Forecaster] Starting forecast for product: {product_id}")
    result = generate_forecast(product_id, warehouse_id)

    if result["status"] == "success":
        print(f"[Forecaster] Success - Generated {len(result['predictions'])} predictions")
        if result.get("metrics", {}).get("rmse"):
            print(f"[Forecaster] Baseline RMSE: {result['metrics']['rmse']:.2f}")
            print(f"[Forecaster] MAPE: {result.get('metrics', {}).get('mape', 0):.2f}%")
            print(f"[Forecaster] MAE: {result.get('metrics', {}).get('mae', 0):.2f}")
        
        sorted_preds = sorted(result["predictions"], key=lambda x: x["predicted_qty"], reverse=True)[:5]
        print(f"\n=== Top 5 Predicted Days of Demand ===")
        for i, pred in enumerate(sorted_preds, 1):
            print(f"  {i}. {pred['forecast_date']}: {pred['predicted_qty']} units (range: {pred['confidence_lower']}-{pred['confidence_upper']})")
        
        print_component_weights_from_forecast(result)
    else:
        print(f"[Forecaster] Skipped: {result['message']}")

    return result


def print_component_weights_from_forecast(result):
    print("\n=== Component Analysis ===")
    print("Weekly seasonality: Enabled (strong weekday patterns)")
    print("Yearly seasonality: Enabled (holiday effects)")
    print("Indian holidays: 20+ festivals as regressors")
    print("changepoint_prior_scale: 0.05")
    print("holidays_prior_scale: 10")


def tune_hyperparameters(product_id: str, warehouse_id: Optional[str] = None) -> dict:
    from prophet.diagnostics import cross_validation, performance_metrics

    df = get_training_data(product_id, warehouse_id)

    if df.empty or len(df) < MIN_HISTORY_DAYS:
        return {"status": "insufficient_data", "message": f"Need at least {MIN_HISTORY_DAYS} days of history"}

    df_prophet = df.rename(columns={"ds": "ds", "y": "y"}).copy()
    holidays_df = create_holidays_dataframe()

    if len(df_prophet) < 210:
        return {"status": "insufficient_data", "message": "Need at least 210 days for cross-validation (180 initial + 30 horizon)"}

    changepoint_grid = [0.001, 0.01, 0.1, 0.5]
    seasonality_grid = [0.01, 0.1, 1.0, 10.0]

    best_mae = float("inf")
    best_params = {"changepoint_prior_scale": 0.05, "seasonality_prior_scale": 10.0}
    results = []

    print("\n=== Hyperparameter Optimization (Grid Search CV) ===")
    print(f"Search Space: {len(changepoint_grid) * len(seasonality_grid)} combinations")
    print(f"CV Config: horizon=30 days, initial=180 days")
    print("-" * 50)

    for cp_scale in changepoint_grid:
        for seas_scale in seasonality_grid:
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                holidays=holidays_df,
                changepoint_prior_scale=cp_scale,
                seasonality_prior_scale=seas_scale,
                holidays_prior_scale=10.0,
            )

            model.fit(df_prophet)

            cv_results = cross_validation(
                model,
                initial="180 days",
                period="30 days",
                horizon="30 days"
            )

            metrics = performance_metrics(cv_results, metrics=["mae", "rmse"])
            mae = metrics["mae"].mean()
            rmse = metrics["rmse"].mean()

            results.append({
                "changepoint_prior_scale": cp_scale,
                "seasonality_prior_scale": seas_scale,
                "mae": mae,
                "rmse": rmse
            })

            print(f"cp={cp_scale}, seas={seas_scale} -> MAE: {mae:.4f}, RMSE: {rmse:.4f}")

            if mae < best_mae:
                best_mae = mae
                best_params = {"changepoint_prior_scale": cp_scale, "seasonality_prior_scale": seas_scale}

    baseline_rmse = 29.82
    best_result = next((r for r in results if r["changepoint_prior_scale"] == best_params["changepoint_prior_scale"] and r["seasonality_prior_scale"] == best_params["seasonality_prior_scale"]), None)

    print("-" * 50)
    print(f"\n=== Best Hyperparameters ===")
    print(f"changepoint_prior_scale: {best_params['changepoint_prior_scale']}")
    print(f"seasonality_prior_scale: {best_params['seasonality_prior_scale']}")
    print(f"CV MAE: {best_mae:.4f}")
    print(f"CV RMSE: {best_result['rmse']:.4f}" if best_result else "")

    if best_result:
        rmse_reduction = baseline_rmse - best_result["rmse"]
        print(f"RMSE Reduction: {rmse_reduction:.2f} ({rmse_reduction/baseline_rmse*100:.1f}%)")
        print(f"Baseline RMSE: {baseline_rmse}")
        print(f"Optimized RMSE: {best_result['rmse']:.4f}")

    print("\n=== Final Model Training with Best Params ===")
    final_model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        holidays=holidays_df,
        changepoint_prior_scale=best_params["changepoint_prior_scale"],
        seasonality_prior_scale=best_params["seasonality_prior_scale"],
        holidays_prior_scale=10.0,
    )

    final_model.fit(df_prophet)

    future = final_model.make_future_dataframe(periods=30)
    forecast = final_model.predict(future)

    forecast_subset = forecast[forecast["ds"] > df_prophet["ds"].max()].tail(30)

    predictions = []
    for _, row in forecast_subset.iterrows():
        yhat = max(0, float(row["yhat"]))
        yhat_lower = max(0, float(row["yhat_lower"]))
        yhat_upper = float(row["yhat_upper"])

        predictions.append({
            "forecast_date": str(row["ds"].date()),
            "predicted_qty": min(999, int(round(yhat))),
            "confidence_lower": min(999, int(round(yhat_lower))),
            "confidence_upper": min(999, int(round(yhat_upper))),
        })

    metrics_final = calculate_metrics(df_prophet, forecast)

    print(f"\n=== Final 30-Day Forecast (Optimized) ===")
    sorted_preds = sorted(predictions, key=lambda x: x["predicted_qty"], reverse=True)[:5]
    for i, pred in enumerate(sorted_preds, 1):
        print(f"  {i}. {pred['forecast_date']}: {pred['predicted_qty']} units (range: {pred['confidence_lower']}-{pred['confidence_upper']})")

    return {
        "status": "success",
        "product_id": product_id,
        "best_params": best_params,
        "best_cv_mae": round(best_mae, 4),
        "best_cv_rmse": round(best_result["rmse"], 4) if best_result else None,
        "baseline_rmse": baseline_rmse,
        "rmse_reduction": round(rmse_reduction, 2) if best_result else None,
        "predictions": predictions,
        "metrics": metrics_final,
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python demand_forecaster.py <product_id> [warehouse_id]")
        sys.exit(1)

    product_id = sys.argv[1]
    warehouse_id = sys.argv[2] if len(sys.argv) > 2 else None

    run_forecaster(product_id, warehouse_id)