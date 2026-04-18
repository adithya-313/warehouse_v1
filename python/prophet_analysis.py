"""
Prophet MAPE Analysis - Detailed diagnostic script
"""

import os
import logging
from datetime import date, timedelta
from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [DIAG] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


def get_all_movement_data(product_id: str, warehouse_id: str) -> pd.DataFrame:
    """Get all movement data for a product."""
    all_data = []
    for offset in range(0, 5000, 1000):
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/stock_movements?select=date,quantity,type"
            f"&product_id=eq.{product_id}&warehouse_id=eq.{warehouse_id}"
            f"&type=eq.out&order=date&limit=1000&offset={offset}",
            headers=HEADERS
        )
        data = resp.json()
        if not data:
            break
        all_data.extend(data)
    
    if not all_data:
        return pd.DataFrame()
    
    df = pd.DataFrame(all_data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    return df


def check_data_quality(df: pd.DataFrame, product_id: str) -> dict:
    """Check data quality issues."""
    issues = []
    
    # Check NULL values
    null_count = df['quantity'].isnull().sum()
    if null_count > 0:
        issues.append(f"NULL values: {null_count}")
    
    # Check negative values
    neg_count = (df['quantity'] < 0).sum()
    if neg_count > 0:
        issues.append(f"Negative values: {neg_count}")
    
    # Check duplicate dates
    dup_count = df['date'].duplicated().sum()
    if dup_count > 0:
        issues.append(f"Duplicate dates: {dup_count}")
    
    # Check zero values
    zero_count = (df['quantity'] == 0).sum()
    if zero_count > 0:
        issues.append(f"Zero values: {zero_count}")
    
    return {
        "total_records": len(df),
        "unique_dates": df['date'].nunique(),
        "date_range": f"{df['date'].min().date()} to {df['date'].max().date()}",
        "avg_demand": df['quantity'].mean(),
        "std_demand": df['quantity'].std(),
        "issues": issues if issues else ["None - data is clean"]
    }


def analyze_single_product(product_id: str, warehouse_id: str, product_type: str):
    """Analyze Prophet performance for a single product."""
    logger.info(f"\n{'='*60}")
    logger.info(f"PRODUCT: {product_id[:30]}... ({product_type})")
    logger.info(f"{'='*60}")
    
    df = get_all_movement_data(product_id, warehouse_id)
    
    if df.empty:
        logger.warning("No data found")
        return
    
    # Data quality check
    logger.info("\n--- DATA QUALITY REPORT ---")
    quality = check_data_quality(df, product_id)
    logger.info(f"Total records: {quality['total_records']}")
    logger.info(f"Unique dates: {quality['unique_dates']}")
    logger.info(f"Date range: {quality['date_range']}")
    logger.info(f"Avg demand: {quality['avg_demand']:.2f}")
    logger.info(f"Std dev: {quality['std_demand']:.2f}")
    for issue in quality['issues']:
        logger.warning(f"  Issue: {issue}")
    
    if quality['unique_dates'] < 30:
        logger.warning(f"Insufficient data: {quality['unique_dates']} days")
        return
    
    # Aggregate to daily demand
    daily = df.groupby('date')['quantity'].sum().reset_index()
    daily.columns = ['ds', 'y']
    daily = daily.sort_values('ds').reset_index(drop=True)
    
    # Forward fill gaps
    full_range = pd.date_range(start=daily['ds'].min(), end=daily['ds'].max(), freq='D')
    daily = daily.set_index('ds').reindex(full_range, fill_value=0).reset_index()
    daily.columns = ['ds', 'y']
    
    logger.info(f"\n--- TRAINING DATA ---")
    logger.info(f"Days: {len(daily)}")
    logger.info(f"First 5: {daily.head()['ds'].dt.strftime('%Y-%m-%d').tolist()}")
    logger.info(f"Last 5: {daily.tail()['ds'].dt.strftime('%Y-%m-%d').tolist()}")
    
    # Train/test split
    train_size = int(len(daily) * 0.8)
    train_df = daily.iloc[:train_size]
    test_df = daily.iloc[train_size:]
    
    logger.info(f"Train: {len(train_df)} days, Test: {len(test_df)} days")
    
    # === SCENARIO A: With seasonality ===
    logger.info("\n--- SCENARIO A: Prophet WITH custom seasonality ---")
    try:
        from prophet import Prophet
        
        model_a = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            growth='linear',
            interval_width=0.95,
            changepoint_prior_scale=0.05,
            stan_backend=None,
        )
        model_a.add_seasonality(name='monthly', period=30.5, fourier_order=3)
        model_a.add_seasonality(name='quarterly', period=91.25, fourier_order=2)
        
        model_a.fit(train_df)
        forecast_a = model_a.predict(test_df[['ds']])
        
        y_true = test_df['y'].values
        y_pred_a = forecast_a['yhat'].values
        
        mask = y_true != 0
        if mask.sum() > 0:
            mape_a = np.mean(np.abs((y_true[mask] - y_pred_a[mask]) / y_true[mask]))
            logger.info(f"MAPE (with seasonality): {mape_a*100:.1f}%")
        else:
            mape_a = 1.0
            logger.warning("No non-zero test values")
            
    except Exception as e:
        logger.error(f"Scenario A failed: {e}")
        mape_a = None
        y_pred_a = None
    
    # === SCENARIO B: Without festival/monsoon (base only) ===
    logger.info("\n--- SCENARIO B: Prophet base (NO custom seasonality) ---")
    try:
        model_b = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
            growth='linear',
            interval_width=0.95,
            stan_backend=None,
        )
        
        model_b.fit(train_df)
        forecast_b = model_b.predict(test_df[['ds']])
        
        y_pred_b = forecast_b['yhat'].values
        
        mask = y_true != 0
        if mask.sum() > 0:
            mape_b = np.mean(np.abs((y_true[mask] - y_pred_b[mask]) / y_true[mask]))
            logger.info(f"MAPE (base only): {mape_b*100:.1f}%")
        else:
            mape_b = 1.0
            
    except Exception as e:
        logger.error(f"Scenario B failed: {e}")
        mape_b = None
        y_pred_b = None
    
    # === Comparison ===
    logger.info("\n--- COMPARISON ---")
    if mape_a and mape_b:
        if mape_a < mape_b:
            improvement = (mape_b - mape_a) / mape_b * 100
            logger.info(f"RESULT: Seasonality HELPS ({improvement:.1f}% improvement)")
        else:
            degradation = (mape_a - mape_b) / mape_b * 100
            logger.info(f"RESULT: Seasonality HURTS ({degradation:.1f}% worse)")
    
    # Print prediction errors
    if y_pred_a is not None:
        logger.info("\n--- PREDICTION ERRORS (first 10 test days) ---")
        for i in range(min(10, len(test_df))):
            actual = y_true[i]
            pred = y_pred_a[i]
            error_pct = abs(actual - pred) / actual * 100 if actual > 0 else 0
            date = test_df.iloc[i]['ds'].date()
            logger.info(f"  {date}: Actual={actual:.0f}, Predicted={pred:.0f}, Error={error_pct:.0f}%")


def main():
    # Get products with different types
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/inventory?select=product_id,warehouse_id&limit=10",
        headers=HEADERS
    )
    products = resp.json()
    
    # Test with 1 product from each type
    test_cases = [
        (products[0]['product_id'], products[0]['warehouse_id'], 'fast'),
        (products[4]['product_id'], products[4]['warehouse_id'], 'medium'),
        (products[8]['product_id'], products[8]['warehouse_id'], 'slow'),
    ]
    
    for product_id, warehouse_id, ptype in test_cases:
        analyze_single_product(product_id, warehouse_id, ptype)
        logger.info("")


if __name__ == "__main__":
    main()