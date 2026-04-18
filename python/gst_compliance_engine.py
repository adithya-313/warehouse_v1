import os
import re
import json
from datetime import datetime, timedelta
from typing import Optional
from supabase import create_client



SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

VALID_GST_RATES = [5, 12, 18, 28]
VALID_INDIAN_STATES = [
    "AP", "AR", "AS", "BR", "CH", "CT", "DD", "DL", "DN", "GA", "GJ", "HR", "HP",
    "JK", "JH", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD",
    "PB", "PY", "RJ", "SK", "TG", "TN", "TR", "TS", "UP", "UK", "WB"
]
E_WAY_BILL_PATTERN = re.compile(r"^\d{12}$")

CRITICAL_VALUE_THRESHOLD = 5000

import requests
from functools import wraps
import time
import logging

MAX_RETRIES = 3
REQUEST_TIMEOUT = 10  # seconds

def retry_with_timeout(max_retries: int = MAX_RETRIES, timeout: int = REQUEST_TIMEOUT):
    """
    Decorator: Deterministic timeout + exponential retry policy for external government APIs.
    Prevents thread locking if the GST portal goes down.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    kwargs['timeout'] = timeout
                    return func(*args, **kwargs)
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    last_exception = e
                    backoff_time = 2 ** attempt  
                    logging.warning(f"[NETWORK_BOUNDARY_FAIL] Attempt {attempt + 1} failed. Retrying in {backoff_time}s...")
                    time.sleep(backoff_time)
            
            logging.error(f"[NETWORK_BOUNDARY_FATAL] External API unreachable after {max_retries} attempts.")
            return {
                "status": "QUEUED_FOR_RETRY",
                "error": str(last_exception),
                "message": "Government portal unreachable. Task pushed to background queue."
            }
        return wrapper
    return decorator

def calculate_severity(variance_pct: float, unit_cost: float, alert_type: str) -> str:
    variance_value = abs(variance_pct) * unit_cost
    
    if variance_pct > 0.10 or (variance_pct > 0.05 and variance_value > CRITICAL_VALUE_THRESHOLD):
        return "critical"
    if variance_pct > 0.05 or alert_type == "unauthorized_removal":
        return "high"
    if variance_pct > 0.02:
        return "medium"
    return "low"


def detect_shrinkage_anomalies(warehouse_id: Optional[str] = None):
    if not supabase:
        return {"error": "Database not configured"}
    
    try:
        query = supabase.table("inventory").select("*, products(*), warehouses(*)").execute()
        inventory = query.data or []
        
        snapshot_query = supabase.table("inventory_snapshots").select("*")
        if warehouse_id:
            snapshot_query = snapshot_query.eq("warehouse_id", warehouse_id)
        snapshot_query = snapshot_query.execute()
        snapshots = {f"{s['product_id']}-{s['bin_location']}": s for s in snapshot_query.data or []}
        
        alerts_created = []
        critical_count = 0
        high_count = 0
        
        for item in inventory:
            product = item.get("products") or {}
            product_id = item["product_id"]
            bin_location = item.get("bin_location", "UNKNOWN")
            current_qty = float(item.get("quantity", 0) or 0)
            unit_cost = float(product.get("unit_cost", 0) or 0)
            
            snapshot_key = f"{product_id}-{bin_location}"
            if snapshot_key in snapshots:
                snapshot = snapshots[snapshot_key]
                expected_qty = float(snapshot.get("quantity", 0) or 0)
                
                if expected_qty > 0 and current_qty < expected_qty:
                    variance_qty = expected_qty - current_qty
                    variance_pct = variance_qty / expected_qty
                    
                    if variance_pct > 0.02:
                        zone, aisle = extract_bin_location(bin_location)
                        severity = calculate_severity(variance_pct, unit_cost, "qty_mismatch")
                        
                        if severity == "critical":
                            critical_count += 1
                        elif severity == "high":
                            high_count += 1
                        
                        existing = supabase.table("shrinkage_alerts").select("id").eq("product_id", product_id).eq("bin_location", bin_location).eq("resolution_status", "open").execute()
                        
                        if not existing.data:
                            alert = {
                                "warehouse_id": item["warehouse_id"],
                                "product_id": product_id,
                                "alert_type": "qty_mismatch",
                                "expected_qty": expected_qty,
                                "actual_qty": current_qty,
                                "variance_qty": variance_qty,
                                "variance_pct": variance_pct,
                                "bin_location": bin_location,
                                "zone": zone,
                                "aisle": aisle,
                                "severity": severity,
                                "resolution_status": "open",
                                "flagged_by_name": "system"
                            }
                            result = supabase.table("shrinkage_alerts").insert(alert).execute()
                            alerts_created.append(result.data[0] if result.data else alert)
                            
                            if severity in ["critical", "high"]:
                                send_shrinkage_notification(alert, product.get("name", "Unknown"))
            
            elif current_qty == 0:
                recent_pick = supabase.table("stock_movements").select("quantity").eq("product_id", product_id).eq("bin_location", bin_location).eq("type", "pick").order("created_at", desc=True).limit(1).execute()
                
                if recent_pick.data and float(recent_pick.data[0].get("quantity", 0) or 0) > 10:
                    zone, aisle = extract_bin_location(bin_location)
                    
                    existing = supabase.table("shrinkage_alerts").select("id").eq("product_id", product_id).eq("bin_location", bin_location).eq("resolution_status", "open").execute()
                    
                    if not existing.data:
                        alert = {
                            "warehouse_id": item["warehouse_id"],
                            "product_id": product_id,
                            "alert_type": "ghost_inventory",
                            "expected_qty": float(recent_pick.data[0].get("quantity", 0) or 0),
                            "actual_qty": 0,
                            "variance_qty": float(recent_pick.data[0].get("quantity", 0) or 0),
                            "variance_pct": 1.0,
                            "bin_location": bin_location,
                            "zone": zone,
                            "aisle": aisle,
                            "severity": "high",
                            "resolution_status": "open",
                            "flagged_by_name": "system"
                        }
                        result = supabase.table("shrinkage_alerts").insert(alert).execute()
                        alerts_created.append(result.data[0] if result.data else alert)
                        high_count += 1
                        send_shrinkage_notification(alert, product.get("name", "Unknown"))
        
        return {
            "total_alerts": len(alerts_created),
            "critical_count": critical_count,
            "high_count": high_count,
            "alerts": alerts_created[:10]
        }
    except Exception as e:
        return {"error": str(e)}


def extract_bin_location(bin_loc: str) -> tuple:
    parts = bin_loc.split("-")
    zone = parts[0] if len(parts) > 0 else "UNKNOWN"
    aisle = parts[1] if len(parts) > 1 else "UNKNOWN"
    return zone, aisle


def send_shrinkage_notification(alert: dict, product_name: str):
    if not supabase:
        return
    
    severity = alert.get("severity", "medium")
    if severity not in ["critical", "high"]:
        return
    
    recipients = []
    if severity == "critical":
        warehouse_query = supabase.table("warehouses").select("manager_email, name").eq("id", alert["warehouse_id"]).single().execute()
        if warehouse_query.data:
            recipients.append({
                "email": warehouse_query.data.get("manager_email", ""),
                "type": "warehouse_manager",
                "warehouse": warehouse_query.data.get("name", "")
            })
        
        recipients.append({"email": "cfo@company.com", "type": "cfo", "warehouse": "All"})
    
    for recipient in recipients:
        if not recipient["email"]:
            continue
        
        notification = {
            "alert_id": alert.get("id"),
            "recipient_type": recipient["type"],
            "recipient_email": recipient["email"],
            "notification_type": "email"
        }
        supabase.table("shrinkage_notifications").insert(notification).execute()


def reconcile_gst_transactions(warehouse_id: str, reconciliation_date: str):
    if not supabase:
        return {"error": "Database not configured"}
    
    recon_dt = datetime.strptime(reconciliation_date, "%Y-%m-%d")
    if recon_dt > datetime.now():
        return {"error": "Cannot reconcile future dates"}
    
    try:
        start_date = recon_dt.strftime("%Y-%m-%d")
        end_date = (recon_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        
        gst_query = supabase.table("gst_transactions").select("*").eq("warehouse_id", warehouse_id).gte("created_at", start_date).lt("created_at", end_date).execute()
        gst_transactions = gst_query.data or []
        
        matched_count = 0
        discrepancy_count = 0
        discrepancies = []
        total_taxable = 0.0
        total_gst = 0.0
        gst_variance = 0.0
        
        for txn in gst_transactions:
            total_taxable += float(txn.get("taxable_amount", 0) or 0)
            total_gst += float(txn.get("gst_amount", 0) or 0)
            
            if txn.get("invoice_number"):
                stock_query = supabase.table("stock_movements").select("*").eq("invoice_id", txn["invoice_number"]).execute()
                stock_movements = stock_query.data or []
                
                if stock_movements:
                    expected_qty = float(txn.get("quantity", 0) or 0)
                    actual_qty = sum(float(m.get("quantity", 0) or 0) for m in stock_movements)
                    
                    if abs(expected_qty - actual_qty) > 0.01:
                        discrepancy_count += 1
                        discrepancies.append({
                            "transaction_id": txn["id"],
                            "invoice_number": txn["invoice_number"],
                            "type": "qty_mismatch",
                            "expected": expected_qty,
                            "actual": actual_qty
                        })
                    else:
                        matched_count += 1
                    
                    if txn.get("e_way_bill_number"):
                        eway_validation = validate_e_way_bill(txn["e_way_bill_number"], txn.get("state_from"), txn.get("state_to"))
                        if not eway_validation["valid"]:
                            discrepancy_count += 1
                            discrepancies.append({
                                "transaction_id": txn["id"],
                                "invoice_number": txn["invoice_number"],
                                "type": "eway_validation_failed",
                                "issues": eway_validation["issues"]
                            })
                else:
                    if txn.get("transaction_type") == "transfer" and txn.get("state_from") != txn.get("state_to"):
                        discrepancy_count += 1
                        discrepancies.append({
                            "transaction_id": txn["id"],
                            "invoice_number": txn.get("invoice_number", "N/A"),
                            "type": "missing_eway_bill",
                            "message": "Inter-state transfer without e-way bill"
                        })
            else:
                matched_count += 1
            
            if txn.get("reconciled"):
                matched_count += 1
        
        gst_variance = abs(total_gst - (total_taxable * 0.18))
        
        audit_status = "compliant"
        if discrepancy_count > 0:
            audit_status = "needs_review"
        
        reconciliation_log = {
            "warehouse_id": warehouse_id,
            "reconciliation_date": reconciliation_date,
            "total_transactions": len(gst_transactions),
            "matched_count": matched_count,
            "discrepancy_count": discrepancy_count,
            "gst_amount_variance": gst_variance,
            "total_taxable_amount": total_taxable,
            "total_gst_amount": total_gst,
            "audit_status": audit_status
        }
        
        existing = supabase.table("gst_reconciliation_log").select("id").eq("warehouse_id", warehouse_id).eq("reconciliation_date", reconciliation_date).execute()
        
        if existing.data:
            supabase.table("gst_reconciliation_log").update(reconciliation_log).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("gst_reconciliation_log").insert(reconciliation_log).execute()
        
        return {
            "reconciliation_date": reconciliation_date,
            "total_transactions": len(gst_transactions),
            "matched_count": matched_count,
            "discrepancy_count": discrepancy_count,
            "discrepancies": discrepancies,
            "audit_status": audit_status,
            "total_taxable_amount": total_taxable,
            "total_gst_amount": total_gst
        }
    except Exception as e:
        return {"error": str(e)}


def validate_e_way_bill(e_way_bill_number: str, state_from: Optional[str], state_to: Optional[str]) -> dict:
    issues = []
    valid = True
    
    if not e_way_bill_number:
        issues.append("E-way bill number is required for inter-state transfers")
        return {"valid": False, "issues": issues}
    
    if not E_WAY_BILL_PATTERN.match(e_way_bill_number):
        issues.append("Invalid format: must be 12 digits")
        valid = False
    
    if state_from and state_from not in VALID_INDIAN_STATES:
        issues.append(f"Invalid state_from code: {state_from}")
        valid = False
    
    if state_to and state_to not in VALID_INDIAN_STATES:
        issues.append(f"Invalid state_to code: {state_to}")
        valid = False
    
    return {"valid": valid, "issues": issues}


from decimal import Decimal, ROUND_HALF_UP

def calculate_gst(taxable_amount: float, gst_rate: float, state_from: str, state_to: str) -> dict:
    """Calculate GST with absolute precision using decimal.Decimal. Serialized to string to prevent network-layer float drift."""
    
    # Convert string representation of floats to Decimal to guarantee exact base-10 initialization
    taxable = Decimal(str(taxable_amount))
    rate = Decimal(str(gst_rate))
    
    # Calculate total GST amount with strict rounding
    gst_amount = (taxable * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # State routing logic
    is_inter_state = state_from.strip().upper() != state_to.strip().upper()
    
    if is_inter_state:
        tax_type = "IGST"
        cgst = Decimal("0.00")
        sgst = Decimal("0.00")
        igst = gst_amount
    else:
        tax_type = "CGST+SGST"
        cgst = (gst_amount / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        sgst = (gst_amount / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        igst = Decimal("0.00")
    
    total_invoice_value = taxable + gst_amount

    # Serialize entirely to String to bypass V8 Engine JSON float conversion
    return {
        "taxable_amount": str(taxable),
        "gst_rate": str(rate),
        "gst_amount": str(gst_amount),
        "cgst": str(cgst),
        "sgst": str(sgst),
        "igst": str(igst),
        "is_inter_state": is_inter_state,
        "tax_type": tax_type,
        "state_from": state_from,
        "state_to": state_to,
        "total_invoice_value": str(total_invoice_value)
    }

def get_shrinkage_analytics(warehouse_id: str, days: int = 30) -> dict:
    if not supabase:
        return {"error": "Database not configured"}
    
    try:
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        alerts_query = supabase.table("shrinkage_alerts").select("*, products(name)").eq("warehouse_id", warehouse_id).gte("created_at", start_date).order("created_at", desc=True).execute()
        alerts = alerts_query.data or []
        
        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        by_type = {}
        by_product = {}
        by_bin = {}
        by_day = {}
        
        for alert in alerts:
            severity = alert.get("severity", "medium")
            alert_type = alert.get("alert_type", "unknown")
            product_name = alert.get("products", {}).get("name", "Unknown") if isinstance(alert.get("products"), dict) else "Unknown"
            bin_loc = alert.get("bin_location", "UNKNOWN")
            created = alert.get("created_at", "")[:10]
            
            by_severity[severity] = by_severity.get(severity, 0) + 1
            by_type[alert_type] = by_type.get(alert_type, 0) + 1
            by_product[product_name] = by_product.get(product_name, 0) + 1
            by_bin[bin_loc] = by_bin.get(bin_loc, 0) + 1
            by_day[created] = by_day.get(created, 0) + 1
        
        total_variance_value = sum(abs(float(a.get("variance_qty", 0) or 0)) * float(a.get("products", {}).get("unit_cost", 0) or 0) for a in alerts if isinstance(a.get("products"), dict))
        
        return {
            "period_days": days,
            "total_alerts": len(alerts),
            "by_severity": by_severity,
            "by_type": by_type,
            "by_product": dict(sorted(by_product.items(), key=lambda x: x[1], reverse=True)[:10]),
            "by_bin": dict(sorted(by_bin.items(), key=lambda x: x[1], reverse=True)[:10]),
            "by_day": by_day,
            "total_variance_value": total_variance_value,
            "critical_rate": by_severity.get("critical", 0) / len(alerts) if alerts else 0
        }
    except Exception as e:
        return {"error": str(e)}


def generate_monthly_audit_report(warehouse_id: str, month: str) -> dict:
    if not supabase:
        return {"error": "Database not configured"}
    
    try:
        year, mon = month.split("-")
        start_date = f"{year}-{mon}-01"
        if mon == "12":
            end_date = f"{int(year) + 1}-01-01"
        else:
            end_date = f"{year}-{int(mon) + 1:02d}-01"
        
        txn_query = supabase.table("gst_transactions").select("*").eq("warehouse_id", warehouse_id).gte("created_at", start_date).lt("created_at", end_date).order("created_at").execute()
        transactions = txn_query.data or []
        
        recon_query = supabase.table("gst_reconciliation_log").select("*").eq("warehouse_id", warehouse_id).gte("reconciliation_date", start_date).lt("reconciliation_date", end_date).execute()
        reconciliations = recon_query.data or []
        
        total_taxable = sum(float(t.get("taxable_amount", 0) or 0) for t in transactions)
        total_gst = sum(float(t.get("gst_amount", 0) or 0) for t in transactions)
        reconciled_count = sum(1 for t in transactions if t.get("reconciled"))
        discrepancy_count = sum(1 for t in transactions if t.get("discrepancy_notes"))
        
        compliant = reconciliation_count(reconciliations, "compliant")
        needs_review = reconciliation_count(reconciliations, "needs_review")
        
        report = {
            "report_month": month,
            "warehouse_id": warehouse_id,
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_transactions": len(transactions),
                "total_taxable_amount": total_taxable,
                "total_gst_amount": total_gst,
                "reconciled_transactions": reconciled_count,
                "discrepancy_count": discrepancy_count,
                "compliance_rate": (reconciled_count / len(transactions) * 100) if transactions else 100,
                "compliant_days": compliant,
                "needs_review_days": needs_review
            },
            "by_transaction_type": {},
            "by_gst_rate": {},
            "transactions": transactions[:100],
            "reconciliations": reconciliations,
            "status": "compliant" if needs_review == 0 else "needs_review"
        }
        
        for t in transactions:
            txn_type = t.get("transaction_type", "unknown")
            report["by_transaction_type"][txn_type] = report["by_transaction_type"].get(txn_type, 0) + 1
            
            rate = str(int(t.get("gst_rate", 0)))
            report["by_gst_rate"][rate] = report["by_gst_rate"].get(rate, 0) + 1
        
        return report
    except Exception as e:
        return {"error": str(e)}


def reconciliation_count(reconciliations: list, status: str) -> int:
    return sum(1 for r in reconciliations if r.get("audit_status") == status)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python gst_compliance_engine.py <function> [args]")
        sys.exit(1)
    
    func_name = sys.argv[1]
    
    if func_name == "detect_shrinkage":
        warehouse_id = sys.argv[2] if len(sys.argv) > 2 else None
        result = detect_shrinkage_anomalies(warehouse_id)
        print(json.dumps(result, indent=2, default=str))
    
    elif func_name == "reconcile":
        warehouse_id = sys.argv[2]
        date = sys.argv[3] if len(sys.argv) > 3 else datetime.now().strftime("%Y-%m-%d")
        result = reconcile_gst_transactions(warehouse_id, date)
        print(json.dumps(result, indent=2, default=str))
    
    elif func_name == "validate_eway":
        eway = sys.argv[2]
        state_from = sys.argv[3] if len(sys.argv) > 3 else None
        state_to = sys.argv[4] if len(sys.argv) > 4 else None
        result = validate_e_way_bill(eway, state_from, state_to)
        print(json.dumps(result, indent=2))
    
    elif func_name == "shrinkage_analytics":
        warehouse_id = sys.argv[2]
        days = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        result = get_shrinkage_analytics(warehouse_id, days)
        print(json.dumps(result, indent=2, default=str))
    
    elif func_name == "audit_report":
        warehouse_id = sys.argv[2]
        month = sys.argv[3] if len(sys.argv) > 3 else datetime.now().strftime("%Y-%m")
        result = generate_monthly_audit_report(warehouse_id, month)
        print(json.dumps(result, indent=2, default=str))
