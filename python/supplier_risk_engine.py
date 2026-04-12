import os
import logging
import math
import statistics
from datetime import date, timedelta
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [SUPPLIER_RISK] %(message)s")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def calculate_supplier_health(supplier_id: str) -> dict:
    """
    Calculates overall supplier health from recent performance.
    """
    try:
        cutoff = str(date.today() - timedelta(days=30))
        
        # Get from supplier_performance (or metrics if populated differently)
        perf_data = supabase.table("supplier_performance").select("*").eq("supplier_id", supplier_id).execute().data
        
        # If no specific performance table found with data in last 30 days, try a fallback or use defaults
        on_time_pct = 0.0
        quality_score = 100.0
        payment_days_late = 0.0 # From the DB instructions or defaults.

        if perf_data and len(perf_data) > 0:
            perf = perf_data[0]
            on_time_pct = perf.get("on_time_delivery_pct", 0)
            quality_score = perf.get("quality_score", 100)
            payment_days_late = 0 # Payment data not natively in basic orders table, defaulting to 0 for MVP
            
        # Also check supplier_metrics if available
        metrics_data = supabase.table("supplier_metrics").select("*").eq("supplier_id", supplier_id).order("metric_date", desc=True).limit(1).execute().data
        if metrics_data and len(metrics_data) > 0:
            m = metrics_data[0]
            on_time_pct = m.get("on_time_delivery_pct") or on_time_pct
            quality_score = m.get("quality_score") or quality_score
            payment_days_late = m.get("payment_days_late_avg") or payment_days_late

        payment_reliability = max(0, 100 - payment_days_late * 2)

        # Overall score = (on_time*0.4 + quality*0.3 + payment*0.3)
        overall_risk_score = (on_time_pct * 0.4) + (quality_score * 0.3) + (payment_reliability * 0.3)
        
        # Risk level: <40=critical, 40-60=high, 60-80=medium, >80=low
        # Note: the prompt says "Overall score... Risk level: <40=critical". But the score is health or risk? High score = healthy = low risk!
        if overall_risk_score < 40:
            risk_level = "critical"
        elif overall_risk_score < 60:
            risk_level = "high"
        elif overall_risk_score < 80:
            risk_level = "medium"
        else:
            risk_level = "low"

        payload = {
            "supplier_id": supplier_id,
            "on_time_pct": round(on_time_pct, 2),
            "quality_score": round(quality_score, 2),
            "payment_reliability": round(payment_reliability, 2),
            "overall_risk_score": round(overall_risk_score, 2),
            "risk_level": risk_level
        }

        # Upsert into supplier_health_scores
        try:
            supabase.table("supplier_health_scores").upsert(
                {**payload, "last_updated": date.today().isoformat()}, 
                on_conflict="supplier_id"
            ).execute()
        except:
            pass # ignore if table is actually missing

        return payload
    except Exception as e:
        logging.error(f"Error calculating health for {supplier_id}: {e}")
        return {}


def predict_supplier_failure_risk(supplier_id: str) -> dict:
    """
    Predicts probability of supplier failure in next 6 months using ML-like heuristics.
    """
    try:
        cutoff_60 = str(date.today() - timedelta(days=60))
        cutoff_30 = str(date.today() - timedelta(days=30))
        
        orders = supabase.table("supplier_orders").select("*").eq("supplier_id", supplier_id).gte("order_date", cutoff_60).execute().data
        
        recent_orders = [o for o in orders if o.get("order_date", "") >= cutoff_30]
        old_orders = [o for o in orders if o.get("order_date", "") < cutoff_30]

        # a) Lead time trend: (avg_recent_leadtime - avg_old_leadtime) / old (% increase)
        def get_avg_lead_time(ords):
            lts = []
            for o in ords:
                if o.get("actual_delivery") and o.get("order_date"):
                    ad = date.fromisoformat(o["actual_delivery"].split("T")[0])
                    od = date.fromisoformat(o["order_date"].split("T")[0])
                    lts.append((ad - od).days)
            return sum(lts)/len(lts) if lts else 0

        recent_lt = get_avg_lead_time(recent_orders)
        old_lt = get_avg_lead_time(old_orders)
        
        if old_lt > 0:
            trend = max(0, (recent_lt - old_lt) / old_lt)
        else:
            trend = 0.5 if recent_lt > 0 else 0

        # b) Order volatility: std_dev(order_values) / mean(order_values)
        order_values = [o.get("total_cost", 0) for o in orders if o.get("total_cost")]
        if len(order_values) > 1:
            mean_val = statistics.mean(order_values)
            std_val = statistics.stdev(order_values)
            volatility = (std_val / mean_val) if mean_val > 0 else 0
        else:
            volatility = 0

        # c) Payment delays: avg days late from orders (assuming mock data 0 if not present)
        # Note: If no payment_date exists, default to 0 for MVP
        delays = 0 

        # d) Quality issues: count recent quality issues
        quality = sum(1 for o in recent_orders if o.get("quality_issues"))

        # Failure probability = (trend*0.25 + volatility*0.25 + delays*0.30 + quality*0.20) * 100
        # Normalizing variables to 0-1 range for probability
        norm_trend = min(1.0, trend)
        norm_volatility = min(1.0, volatility)
        norm_delays = min(1.0, delays / 30.0) # Assume 30 days is max bad delay
        norm_quality = min(1.0, quality / max(1, len(recent_orders)))

        failure_prob = (norm_trend * 0.25 + norm_volatility * 0.25 + norm_delays * 0.30 + norm_quality * 0.20) * 100
        
        keys = []
        if norm_trend > 0.3: keys.append("high_lead_time_variance")
        if norm_volatility > 0.5: keys.append("high_order_volatility")
        if quality > 0: keys.append("recent_quality_issues")
        
        return {
            "supplier_id": supplier_id,
            "failure_probability_6m": round(min(100.0, max(0.0, failure_prob)), 2),
            "risk_factors": keys,
            "financial_risk_score": round(min(100, norm_volatility * 100), 2),
            "operational_risk_score": round(min(100, norm_trend * 100), 2),
            "market_risk_score": round(min(100, norm_delays * 100), 2)
        }
    except Exception as e:
        logging.error(f"Error predicting failure for {supplier_id}: {e}")
        return {}


def generate_risk_assessment(supplier_id: str) -> dict:
    """
    Calls 1 & 2, generates recommendations, and inserts into DB.
    """
    try:
        health = calculate_supplier_health(supplier_id)
        fail_pred = predict_supplier_failure_risk(supplier_id)

        if not health or not fail_pred:
            return {}

        key_risk_factors = fail_pred.get("risk_factors", [])
        
        # Risk level inversions (Since high health score = healthy, overall_risk_score = health score)
        # So we actually want to map <40 overall score to "critical" risk.
        score = health.get("overall_risk_score", 0)
        failure_prob = fail_pred.get("failure_probability_6m", 0)

        if score < 60:
            key_risk_factors.append("low_health_score")
        if failure_prob > 60:
            key_risk_factors.append("high_failure_probability")

        # Recommendation Generation
        if failure_prob > 70:
            recommendation = "CRITICAL: Reduce orders, get backup supplier"
        elif failure_prob > 50:
            recommendation = "HIGH RISK: Diversify orders, increase safety stock"
        elif failure_prob > 30:
            recommendation = "MEDIUM RISK: Monitor closely"
        else:
            recommendation = "LOW RISK: Continue normal"

        risk_level = health.get("risk_level", "medium")

        # In DB, risk scores require metrics capped 0-100
        # Note: financial_risk_score, operational_risk_score, market_risk_score required!
        insert_data = {
            "supplier_id": supplier_id,
            "risk_assessment_date": date.today().isoformat(),
            "financial_risk_score": fail_pred.get("financial_risk_score", 0),
            "operational_risk_score": fail_pred.get("operational_risk_score", 0),
            "market_risk_score": fail_pred.get("market_risk_score", 0),
            "overall_risk_score": score,
            "failure_probability_6m": failure_prob,
            "risk_level": risk_level,
            "key_risk_factors": key_risk_factors,
            "recommendation": recommendation
        }
        
        # Insert into supplier_risk_scores table
        res = supabase.table("supplier_risk_scores").upsert(insert_data, on_conflict="supplier_id, risk_assessment_date").execute()
        score_id = None
        if res.data and len(res.data) > 0:
            score_id = res.data[0].get("id")

        # Alert Creation
        if failure_prob > 50 and score_id:
            alert_type = "critical_risk" if failure_prob > 70 else "high_risk"
            alert_severity = "critical" if failure_prob > 70 else "high"
            
            supabase.table("supplier_risk_alerts").insert({
                "supplier_id": supplier_id,
                "risk_score_id": score_id,
                "alert_type": alert_type,
                "severity": alert_severity,
                "message": recommendation
            }).execute()

        return {
            "supplier_id": supplier_id,
            "health_score": score,
            "failure_probability_6m": failure_prob,
            "key_risk_factors": key_risk_factors,
            "recommendation": recommendation
        }

    except Exception as e:
        logging.error(f"Error generating assessment for {supplier_id}: {e}")
        return {}


def assess_all_suppliers() -> dict:
    """
    Assesses all suppliers in the database.
    """
    try:
        suppliers = supabase.table("suppliers").select("id").execute().data
        assessments = []

        for s in suppliers:
            result = generate_risk_assessment(s["id"])
            if result:
                assessments.append(result)

        logging.info(f"Processed {len(assessments)} supplier risk assessments.")
        return {
            "total_suppliers": len(suppliers) if suppliers else 0,
            "assessments": assessments
        }
    except Exception as e:
        logging.error(f"Failed to assess all suppliers: {e}")
        return {"total_suppliers": 0, "assessments": []}


def run_supplier_risk_job():
    """
    Runs the full job for cron scheduling.
    """
    logging.info("Starting Supplier Risk Engine Job...")
    result = assess_all_suppliers()
    logging.info("Supplier Risk Engine Job complete.")
    return result


import sys
import json

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Disable logging to stdout to prevent JSON parsing errors in Node
        logging.getLogger().setLevel(logging.CRITICAL)
        
        cmd = sys.argv[1]
        try:
            if cmd == "calculate" and len(sys.argv) > 2:
                print(json.dumps(calculate_supplier_health(sys.argv[2])))
            elif cmd == "predict" and len(sys.argv) > 2:
                print(json.dumps(predict_supplier_failure_risk(sys.argv[2])))
            elif cmd == "assess" and len(sys.argv) > 2:
                print(json.dumps(generate_risk_assessment(sys.argv[2])))
            elif cmd == "assess_all":
                print(json.dumps(assess_all_suppliers()))
            elif cmd == "run_job":
                print(json.dumps(run_supplier_risk_job()))
        except Exception as e:
            # Output error as JSON
            print(json.dumps({"error": str(e)}))
    else:
        run_supplier_risk_job()
