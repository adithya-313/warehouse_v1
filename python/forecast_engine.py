"""
forecast_engine.py — Demand Forecasting with Facebook Prophet
"""

import os
import logging
from datetime import date, timedelta
from typing import Optional
from supabase import create_client
from dotenv import load_dotenv
import pandas as pd
import numpy as np

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [FORECAST] %(message)s")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

MIN_HISTORY_DAYS = 30
MAX_HISTORY_DAYS = 90
DEFAULT_UNIT_COST = 10.0


def forecast_demand(product_id: str, warehouse_id: str, days_ahead: int) -> dict:
    if days_ahead not in (30, 60, 90):
        raise ValueError("days_ahead must be 30, 60, or 90")

    cutoff = str(date.today() - timedelta(days=MAX_HISTORY_DAYS))
    movements = (
        supabase.table("stock_movements")
        .select("quantity, date")
        .eq("product_id", product_id)
        .eq("warehouse_id", warehouse_id)
        .eq("type", "out")
        .gte("date", cutoff)
        .order("date")
        .execute()
        .data
    )

    if len(movements) < MIN_HISTORY_DAYS:
        raise ValueError(
            f"Insufficient history: {len(movements)} days, need {MIN_HISTORY_DAYS}+ days"
        )

    df = pd.DataFrame(movements)
    df["date"] = pd.to_datetime(df["date"])
    daily_out = df.groupby("date")["quantity"].sum().reset_index()
    daily_out.columns = ["ds", "y"]

    full_range = pd.date_range(start=daily_out["ds"].min(), end=date.today(), freq="D")
    daily_out = daily_out.set_index("ds").reindex(full_range, fill_value=0).reset_index()
    daily_out.columns = ["ds", "y"]

    from prophet import Prophet

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.95,
        changepoint_prior_scale=0.05,
    )
    model.fit(daily_out)

    future = model.make_future_dataframe(periods=days_ahead)
    forecast = model.predict(future)

    last_row = forecast.iloc[-1]
    yhat = float(last_row["yhat"])
    yhat_lower = float(last_row["yhat_lower"])
    yhat_upper = float(last_row["yhat_upper"])

    confidence_range = yhat_upper - yhat_lower
    confidence_score = min(100.0, max(0.0, (1 - confidence_range / (yhat + 1e-9)) * 100))

    recent_forecast = forecast.tail(n=min(7, days_ahead))["yhat"].values
    older_forecast = forecast.tail(n=days_ahead).head(n=min(7, days_ahead))["yhat"].values
    if len(recent_forecast) > 0 and len(older_forecast) > 0:
        slope = np.polyfit(range(len(recent_forecast)), recent_forecast, 1)[0]
        if slope > 0.5:
            trend = "rising"
        elif slope < -0.5:
            trend = "falling"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "forecast_date": date.today().isoformat(),
        "days_ahead": days_ahead,
        "predicted_qty": round(max(0, yhat), 2),
        "confidence_lower": round(max(0, yhat_lower), 2),
        "confidence_upper": round(max(0, yhat_upper), 2),
        "confidence_score": round(confidence_score, 2),
        "trend": trend,
    }


def generate_forecasts(warehouse_id: str) -> dict:
    cutoff = str(date.today() - timedelta(days=MIN_HISTORY_DAYS))

    products = (
        supabase.table("inventory")
        .select("product_id, quantity")
        .eq("warehouse_id", warehouse_id)
        .execute()
        .data
    )

    eligible = []
    for item in products:
        movements_count = (
            supabase.table("stock_movements")
            .select("id", count="exact")
            .eq("product_id", item["product_id"])
            .eq("warehouse_id", warehouse_id)
            .eq("type", "out")
            .gte("date", cutoff)
            .execute()
            .count
        )
        if movements_count and movements_count >= MIN_HISTORY_DAYS:
            eligible.append(item)

    results = {
        "total_products": len(eligible),
        "forecasted": 0,
        "errors": 0,
        "rising": 0,
        "stable": 0,
        "falling": 0,
        "avg_confidence": 0,
    }
    confidences = []

    for item in eligible:
        for days in (30, 60, 90):
            try:
                forecast = forecast_demand(item["product_id"], warehouse_id, days)
                supabase.table("demand_forecast").upsert(
                    forecast,
                    on_conflict="product_id,warehouse_id,days_ahead",
                ).execute()
                results["forecasted"] += 1
                if forecast["trend"] == "rising":
                    results["rising"] += 1
                elif forecast["trend"] == "falling":
                    results["falling"] += 1
                else:
                    results["stable"] += 1
                confidences.append(forecast["confidence_score"])
            except Exception as e:
                logging.warning(f"Forecast failed for {item['product_id']} ({days}d): {e}")
                results["errors"] += 1

    if confidences:
        results["avg_confidence"] = round(sum(confidences) / len(confidences), 2)

    logging.info(f"Forecasts complete for {warehouse_id}: {results}")
    return results


def liquidation_recommendations(warehouse_id: str) -> list[dict]:
    cutoff = str(date.today() - timedelta(days=MIN_HISTORY_DAYS))

    forecasts = (
        supabase.table("demand_forecast")
        .select("*")
        .eq("warehouse_id", warehouse_id)
        .eq("days_ahead", 30)
        .execute()
        .data
    )

    inventory = (
        supabase.table("inventory")
        .select("product_id, quantity")
        .eq("warehouse_id", warehouse_id)
        .execute()
        .data
    )
    inv_map = {i["product_id"]: i["quantity"] for i in inventory}

    products = (
        supabase.table("products")
        .select("id, expiry_date")
        .execute()
        .data
    )
    product_map = {p["id"]: p for p in products}

    analytics = (
        supabase.table("product_analytics")
        .select("product_id, avg_daily_demand")
        .execute()
        .data
    )
    analytics_map = {a["product_id"]: a for a in analytics}

    recommendations = []

    for forecast in forecasts:
        pid = forecast["product_id"]
        current_qty = inv_map.get(pid, 0)
        predicted_qty = forecast["predicted_qty"]

        if predicted_qty == 0:
            continue

        days_supply = current_qty / predicted_qty if predicted_qty > 0 else float("inf")
        avg_daily = analytics_map.get(pid, {}).get("avg_daily_demand", 0)

        last_movement = (
            supabase.table("stock_movements")
            .select("date")
            .eq("product_id", pid)
            .eq("warehouse_id", warehouse_id)
            .order("date", desc=True)
            .limit(1)
            .execute()
            .data
        )
        days_since_movement = None
        if last_movement:
            days_since_movement = (date.today() - date.fromisoformat(last_movement[0]["date"])).days

        if days_since_movement and days_since_movement > 45 and current_qty > predicted_qty * 1.5:
            expiry_str = product_map.get(pid, {}).get("expiry_date")
            days_to_expiry = None
            if expiry_str:
                days_to_expiry = (date.fromisoformat(expiry_str) - date.today()).days

            if days_supply > 120:
                urgency = "high"
                discount_pct = 35.0
                action = "liquidate_discount"
            elif days_supply > 90:
                urgency = "medium"
                discount_pct = 25.0
                action = "liquidate_discount"
            elif days_supply > 60:
                urgency = "low"
                discount_pct = 15.0
                action = "bundle_promotion"
            else:
                continue

            unit_cost = DEFAULT_UNIT_COST
            est_loss = round(current_qty * (1 - forecast["confidence_score"] / 100) * unit_cost, 2)

            recommendations.append({
                "product_id": pid,
                "warehouse_id": warehouse_id,
                "current_qty": current_qty,
                "days_to_expiry": days_to_expiry,
                "recommended_action": action,
                "discount_pct": round(min(50, max(10, discount_pct)), 2),
                "urgency_level": urgency,
                "estimated_revenue_loss": est_loss,
                "days_supply": round(days_supply, 2),
            })

    supabase.table("liquidation_recommendations").delete().eq("warehouse_id", warehouse_id).execute()
    for rec in recommendations:
        supabase.table("liquidation_recommendations").insert(rec).execute()

    recommendations.sort(key=lambda x: (
        {"high": 0, "medium": 1, "low": 2}[x["urgency_level"]],
        -x["estimated_revenue_loss"]
    ))

    logging.info(f"Liquidation recommendations for {warehouse_id}: {len(recommendations)} items")
    return recommendations


def generate_all_forecasts() -> list[dict]:
    warehouses = supabase.table("warehouses").select("id").execute().data
    results = []
    for wh in warehouses:
        try:
            res = generate_forecasts(wh["id"])
            res["warehouse_id"] = wh["id"]
            results.append(res)
        except Exception as e:
            logging.error(f"Forecasts failed for {wh['id']}: {e}")
    return results


def generate_all_liquidation() -> list[dict]:
    warehouses = supabase.table("warehouses").select("id").execute().data
    results = []
    for wh in warehouses:
        try:
            recs = liquidation_recommendations(wh["id"])
            results.append({"warehouse_id": wh["id"], "count": len(recs)})
        except Exception as e:
            logging.error(f"Liquidation failed for {wh['id']}: {e}")
    return results
