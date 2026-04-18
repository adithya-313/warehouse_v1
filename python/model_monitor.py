import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MODEL_VERSION = "v1_prophet_indian_holidays"
ERROR_THRESHOLD = 11.40
DRIFT_THRESHOLD_FACTOR = 1.2


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_yesterday_date() -> str:
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")


def get_predicted_quantity(supabase, product_id: str, warehouse_id: Optional[str], date: str) -> Optional[float]:
    query = supabase.table("demand_forecasts").select(
        "predicted_qty"
    ).eq("product_id", product_id).eq("forecast_date", date)

    if warehouse_id:
        query = query.eq("warehouse_id", warehouse_id)

    result = query.execute()

    if result.data:
        return float(result.data[0]["predicted_qty"])
    return None


def get_actual_quantity(supabase, product_id: str, warehouse_id: Optional[str], date: str) -> Optional[float]:
    query = supabase.table("stock_movements").select(
        "quantity"
    ).eq("product_id", product_id).eq("date", date)

    if warehouse_id:
        query = query.eq("warehouse_id", warehouse_id)

    result = query.execute()

    if result.data:
        total = sum(float(row["quantity"]) for row in result.data)
        return total
    return None


def calculate_residual(actual: float, predicted: float) -> float:
    return actual - predicted


def update_model_metrics(
    supabase,
    product_id: str,
    warehouse_id: Optional[str],
    residual: float,
    date: str,
):
    existing = supabase.table("model_metrics").select("id, mae").eq(
        "product_id", product_id
    ).eq("model_version", MODEL_VERSION).execute()

    if existing.data:
        record = existing.data[0]
        current_mae = record.get("mae") or 0
        
        new_mae = (current_mae + abs(residual)) / 2
        
        supabase.table("model_metrics").update({
            "mae": round(new_mae, 4),
        }).eq("id", record["id"]).execute()
        
        logger.info(f"Updated MAE for {product_id}: {new_mae:.4f}")
    else:
        supabase.table("model_metrics").insert({
            "product_id": product_id,
            "warehouse_id": warehouse_id or "00000000-0000-0000-0000-000000000000",
            "model_version": MODEL_VERSION,
            "mae": round(abs(residual), 4),
            "rmse": round(abs(residual), 4),
            "sample_size": 1,
            "forecast_horizon": 1,
            "training_start_date": date,
            "training_end_date": date,
        }).execute()
        
        logger.info(f"Inserted new metrics for {product_id}")


def get_recent_errors(supabase, product_id: str, days: int = 3) -> list:
    end_date = datetime.now()
    dates = [(end_date - timedelta(days=i+1)).strftime("%Y-%m-%d") for i in range(days)]
    
    errors = []
    
    for date in dates:
        pred = get_predicted_quantity(supabase, product_id, None, date)
        if pred is not None:
            act = get_actual_quantity(supabase, product_id, None, date)
            if act is not None:
                residual = calculate_residual(act, pred)
                errors.append({
                    "date": date,
                    "predicted": pred,
                    "actual": act,
                    "residual": residual,
                    "absolute_error": abs(residual)
                })
    
    return errors


def check_model_drift(supabase, product_id: str) -> dict:
    errors = get_recent_errors(supabase, product_id, days=3)
    
    if len(errors) < 3:
        return {
            "drift_detected": False,
            "message": "Insufficient data for drift detection",
            "errors": errors
        }
    
    avg_error = sum(e["absolute_error"] for e in errors) / len(errors)
    
    is_significant = avg_error > ERROR_THRESHOLD
    
    return {
        "drift_detected": is_significant,
        "avg_error": avg_error,
        "threshold": ERROR_THRESHOLD,
        "errors": errors,
        "product_id": product_id
    }


def run_monitor(product_id: Optional[str] = None):
    supabase = get_supabase_client()
    yesterday = get_yesterday_date()
    
    logger.info("=== Model Monitor Running ===")
    logger.info(f"Date: {yesterday}")
    logger.info(f"Error Threshold: {ERROR_THRESHOLD}")
    
    if product_id:
        product_ids = [product_id]
    else:
        products = supabase.table("products").select("id").execute()
        product_ids = [p["id"] for p in products.data]
    
    drift_alerts = []
    
    for pid in product_ids:
        logger.info(f"\n--- Processing Product: {pid} ---")
        
        predicted = get_predicted_quantity(supabase, pid, None, yesterday)
        
        if predicted is None:
            logger.warning(f"No prediction found for {pid} on {yesterday}")
            continue
            
        actual = get_actual_quantity(supabase, pid, None, yesterday)
        
        if actual is None:
            logger.warning(f"No actual data for {pid} on {yesterday}")
            continue
        
        residual = calculate_residual(actual, predicted)
        
        logger.info(f"Predicted: {predicted:.2f}")
        logger.info(f"Actual: {actual:.2f}")
        logger.info(f"Residual: {residual:.2f} (Actual - Predicted)")
        
        update_model_metrics(supabase, pid, None, residual, yesterday)
        
        drift_result = check_model_drift(supabase, pid)
        
        if drift_result["drift_detected"]:
            msg = (
                f"\n"
                f"=============================================================\n"
                f"[CRITICAL] Model Drift Detected for SKU: {pid}\n"
                f"=============================================================\n"
                f"  Average Error (3-day): {drift_result['avg_error']:.2f}\n"
                f"  Threshold: {drift_result['threshold']:.2f}\n"
                f"  Exceeds threshold by: {drift_result['avg_error'] - drift_result['threshold']:.2f}\n"
                f"\n"
                f"  Recent Errors:\n"
            )
            for e in drift_result["errors"]:
                msg += f"    {e['date']}: pred={e['predicted']:.0f}, actual={e['actual']:.0f}, err={e['absolute_error']:.2f}\n"
            
            msg += "=============================================================\n"
            
            print(msg)
            drift_alerts.append({"product_id": pid, "avg_error": drift_result["avg_error"]})
    
    if drift_alerts:
        logger.warning(f"Drift detected for {len(drift_alerts)} products")
    else:
        logger.info("No model drift detected")
    
    return {
        "status": "completed",
        "products_processed": len(product_ids),
        "drift_alerts": drift_alerts
    }


def main():
    product_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    try:
        result = run_monitor(product_id)
        logger.info(f"Monitor completed: {result['status']}")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Monitor failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()