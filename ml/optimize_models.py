import os
import json
import logging
from datetime import datetime
from typing import Optional
from pathlib import Path

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

try:
    import onnx
    from onnx import helper, tensor_proto
    from skl2onnx import convert_sklearn
    from skl2onnx.common._container import ModelComponentContainer
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    logger.warning("ONNX not available, using native XGBoost")

try:
    import onnxruntime as ort
    ORT_AVAILABLE = True
except ImportError:
    ORT_AVAILABLE = False
    logger.warning("onnxruntime not available")


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def convert_xgboost_to_onnx(model: xgb.XGBRegressor, feature_names: list) -> bytes:
    if not ONNX_AVAILABLE:
        raise ImportError("ONNX not available")
    
    initial_type = [
        ('float_input', helper.make_tensor_value_info(
            tensor_proto.TensorProto.FLOAT, [None, len(feature_names)]
        ))
    ]
    
    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        target_opset=13
    )
    
    return onnx_model.SerializeToString()


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


def create_quantized_model(model: xgb.XGBRegressor, features: list) -> dict:
    model_info = {
        "n_estimators": model.n_estimators,
        "max_depth": model.max_depth,
        "learning_rate": model.learning_rate,
        "feature_names": features,
        "feature_importances": model.feature_importances_.tolist(),
        "quantized_at": datetime.now().isoformat(),
    }
    
    if ONNX_AVAILABLE:
        try:
            onnx_bytes = convert_xgboost_to_onnx(model, features)
            model_info["onnx_size_bytes"] = len(onnx_bytes)
            model_info["onnx_available"] = True
            logger.info(f"ONNX model created: {len(onnx_bytes)} bytes")
            
            return {
                **model_info,
                "onnx_model": onnx_bytes,
            }
        except Exception as e:
            logger.warning(f"ONNX conversion failed: {e}")
            model_info["onnx_available"] = False
    
    return model_info


def create_optimized_inference_session(onnx_model: bytes):
    if not ORT_AVAILABLE:
        raise ImportError("onnxruntime not available")
    
    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess_options.intra_op_num_threads = 4
    sess_options.inter_op_num_threads = 2
    
    sess = ort.InferenceSession(
        onnx_model,
        sess_options=sess_options,
        providers=['CPUExecutionProvider']
    )
    
    logger.info("Created optimized ONNX runtime session")
    return sess


def predict_with_onnx(sess: ort.InferenceSession, features: np.ndarray) -> np.ndarray:
    input_name = sess.get_inputs()[0].name
    output_name = sess.get_outputs()[0].name
    
    result = sess.run([output_name], {input_name: features})[0]
    return result


def optimize_and_upload(supabase, version: str = "v1_latest"):
    logger.info(f"Starting model optimization for version: {version}")
    
    model = load_xgboost_model(supabase, version)
    
    if model is None:
        logger.error("No model to optimize")
        return
    
    feature_names = [
        "lag_1d", "lag_7d", "rolling_avg_7d", "rolling_avg_14d", "rolling_std_7d",
        "day_of_week", "is_weekend", "is_month_start", "is_month_end", "is_holiday"
    ]
    
    model_info = create_quantized_model(model, feature_names)
    
    if "onnx_model" in model_info:
        onnx_path = f"xgboost/{version}/model_quantized.onnx"
        
        supabase.storage.from_("ml-models").upload(
            onnx_path,
            model_info["onnx_model"],
            {"content-type": "application/octet-stream", "upsert": True}
        )
        
        logger.info(f"Uploaded optimized ONNX model to {onnx_path}")
    
    metadata = {
        "version": version,
        "optimized_at": datetime.now().isoformat(),
        "original_size_bytes": model.save_raw().__sizeof__() if hasattr(model.save_raw(), '__sizeof__') else 0,
        "onnx_size_bytes": model_info.get("onnx_size_bytes", 0),
        "quantization": "ONNX",
    }
    
    supabase.storage.from_("ml-models").upload(
        f"xgboost/{version}/optimization_metadata.json",
        json.dumps(metadata),
        {"content-type": "application/json", "upsert": True}
    )
    
    logger.info(f"Optimization complete: {json.dumps(metadata, indent=2)}")
    
    return metadata


def run_optimization():
    supabase = get_supabase_client()
    
    from datetime import datetime
    version = f"v1_{datetime.now().strftime('%Y_%m_%d')}"
    
    result = optimize_and_upload(supabase, version)
    
    return result


def benchmark_inference(
    model: xgb.XGBRegressor,
    onnx_sess: ort.InferenceSession,
    features: np.ndarray,
    n_iterations: int = 1000
) -> dict:
    import time
    
    native_times = []
    onnx_times = []
    
    for _ in range(n_iterations):
        start = time.perf_counter()
        _ = model.predict(features)
        native_times.append(time.perf_counter() - start)
        
        start = time.perf_counter()
        _ = predict_with_onnx(onnx_sess, features)
        onnx_times.append(time.perf_counter() - start)
    
    native_avg = np.mean(native_times) * 1000
    onnx_avg = np.mean(onnx_times) * 1000
    
    return {
        "native_avg_ms": native_avg,
        "onnx_avg_ms": onnx_avg,
        "speedup": native_avg / onnx_avg,
        "iterations": n_iterations,
    }


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "benchmark":
        from inference import (
            get_latest_features,
            prepare_features_for_prediction,
            load_xgboost_model,
        )
        from datetime import datetime
        
        supabase = get_supabase_client()
        
        features_dict = {
            "lag_1d": 100, "lag_7d": 90, "rolling_avg_7d": 95,
            "rolling_avg_14d": 85, "rolling_std_7d": 10,
        }
        features = prepare_features_for_prediction(
            features_dict, datetime.now()
        )
        
        model = load_xgboost_model(supabase)
        
        import onnxruntime as ort
        import io
        
        try:
            onnx_data = supabase.storage.from_("ml-models").download(
                "xgboost/v1_latest/model_quantized.onnx"
            )
            onnx_sess = ort.InferenceSession(
                io.BytesIO(onnx_data),
                providers=['CPUExecutionProvider']
            )
            
            results = benchmark_inference(model, onnx_sess, features)
            print(json.dumps(results, indent=2))
        except Exception as e:
            print(f"Benchmark not available: {e}")
    else:
        run_optimization()