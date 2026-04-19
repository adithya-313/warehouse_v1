import os
import logging
import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import xgboost as xgb

from dotenv import load_dotenv
from supabase import create_client

from inference import (
    get_latest_features,
    load_xgboost_model,
    load_model_metadata,
    fallback_prediction,
    prepare_features_for_prediction,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL")

REQUEST_COUNT = {"total": 0, "errors": 0, "fallbacks": 0}

MODEL_CACHE: Optional[xgb.XGBRegressor] = None
METADATA_CACHE: Optional[Dict] = None
LAST_LOADED: Optional[str] = None


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ML Inference Service...")
    global MODEL_CACHE, METADATA_CACHE, LAST_LOADED
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            supabase = get_supabase_client()
            MODEL_CACHE = load_xgboost_model(supabase)
            METADATA_CACHE = load_model_metadata(supabase, "xgboost")
            LAST_LOADED = "xgboost"
            logger.info(f"Model loaded: {METADATA_CACHE.get('version', 'unknown')}")
        except Exception as e:
            logger.warning(f"Could not load model at startup: {e}")
    
    yield
    
    logger.info("Shutting down ML Inference Service...")


app = FastAPI(
    title="Warehouse ML Inference API",
    description="Demand forecasting inference service",
    version="1.0.0",
    lifespan=lifespan
)


class PredictRequest(BaseModel):
    product_id: str
    model_type: str = "xgboost"
    horizon: int = 7


class ForecastResponse(BaseModel):
    status: str
    product_id: str
    model_type: str
    forecast: List[Dict[str, Any]]
    trend: str
    generated_at: str
    version: Optional[str] = None


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": MODEL_CACHE is not None,
        "model_version": METADATA_CACHE.get("version") if METADATA_CACHE else None
    }


@app.get("/ready")
async def readiness_check():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return {"status": "ready"}


@app.post("/predict", response_model=ForecastResponse)
async def predict(request: PredictRequest):
    logger.info(f"Predict request for product: {request.product_id}")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    supabase = get_supabase_client()
    
    features = get_latest_features(supabase, request.product_id)
    
    if not features:
        raise HTTPException(status_code=404, detail="No features found for product")
    
    if request.model_type == "xgboost" and MODEL_CACHE is not None:
        predictions = []
        
        for i in range(1, request.horizon + 1):
            from datetime import datetime, timedelta
            forecast_date = datetime.now() + timedelta(days=i)
            
            feat_vector = prepare_features_for_prediction(features, forecast_date)
            pred = MODEL_CACHE.predict(feat_vector)
            pred_value = float(max(0, pred[0]))
            
            std = features.get("rolling_std_7d", features.get("rolling_avg_7d", 0) * 0.2)
            
            predictions.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted_qty": int(round(pred_value)),
                "confidence_lower": int(round(max(0, pred_value - 1.645 * std))),
                "confidence_upper": int(round(pred_value + 1.645 * std)),
            })
        
        model_type = "xgboost"
    else:
        preds = fallback_prediction(features, request.horizon)
        
        from datetime import datetime, timedelta
        predictions = []
        for i, pred in enumerate(preds):
            forecast_date = datetime.now() + timedelta(days=i + 1)
            predictions.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted_qty": pred["predicted_qty"],
                "confidence_lower": pred["confidence_lower"],
                "confidence_upper": pred["confidence_upper"],
            })
        
        model_type = "fallback"
    
    base_qty = features.get("rolling_avg_7d", features.get("lag_1d", 0))
    recent_qty = features.get("lag_1d", 0)
    
    if recent_qty > base_qty * 1.2:
        trend = "rising"
    elif recent_qty < base_qty * 0.8:
        trend = "falling"
    else:
        trend = "stable"
    
    from datetime import datetime
    return ForecastResponse(
        status="success",
        product_id=request.product_id,
        model_type=model_type,
        forecast=predictions,
        trend=trend,
        generated_at=datetime.now().isoformat(),
        version=METADATA_CACHE.get("version") if METADATA_CACHE else None
    )


@app.post("/reload-model")
async def reload_model():
    global MODEL_CACHE, METADATA_CACHE, LAST_LOADED
    
    logger.info("Reloading model...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        supabase = get_supabase_client()
        MODEL_CACHE = load_xgboost_model(supabase)
        METADATA_CACHE = load_model_metadata(supabase, "xgboost")
        LAST_LOADED = "xgboost"
        
        return {
            "status": "success",
            "version": METADATA_CACHE.get("version") if METADATA_CACHE else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    global REQUEST_COUNT
    REQUEST_COUNT["errors"] += 1
    
    logger.error(f"Global exception: {exc}")
    
    send_alert_to_webhook("MODEL_ERROR", str(exc))
    
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": str(exc),
            "fallback": "Please use /predict with fallback mode in next request"
        }
    )


def send_alert_to_webhook(alert_type: str, message: str):
    if not ALERT_WEBHOOK_URL:
        return
    
    try:
        payload = {
            "text": f"ML Service Alert: {alert_type}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*{alert_type}* :rotating_light:\n{message}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Errors:*\n{REQUEST_COUNT['errors']}"},
                        {"type": "mrkdwn", "text": f"*Total:*\n{REQUEST_COUNT['total']}"},
                        {"type": "mrkdwn", "text": f"*Timestamp:*\n{datetime.now().isoformat()}"}
                    ]
                }
            ]
        }
        
        import urllib.request
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            ALERT_WEBHOOK_URL,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        logger.warning(f"Failed to send webhook alert: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)