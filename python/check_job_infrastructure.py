"""Diagnostic: Check risk_calculation_jobs infrastructure."""
import os
import sys
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] SUPABASE credentials not configured")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 50)
print("RISK JOB INFRASTRUCTURE DIAGNOSTIC")
print("=" * 50)

issues = []

# 1. Check table
print("\n[1] Checking risk_calculation_jobs table...")
try:
    result = supabase.table("risk_calculation_jobs").select("id").limit(1).execute()
    print("    [OK] Table exists")
except Exception as e:
    if "PGRST205" in str(e):
        issues.append("Table missing")
        print("    [MISSING] Table not found")
    else:
        print(f"    [ERROR] {e}")

# 2. Check RPC function
print("\n[2] Checking claim_risk_job RPC...")
try:
    result = supabase.rpc("claim_risk_job", {"p_job_type": "calculate"}).execute()
    print("    [OK] RPC function exists")
except Exception as e:
    err_str = str(e).lower()
    if "not found" in err_str:
        issues.append("RPC function missing")
        print("    [MISSING] RPC function not found")
    else:
        print("    [OK] RPC exists")

# 3. Check cleanup function
print("\n[3] Checking cleanup_zombie_jobs RPC...")
try:
    result = supabase.rpc("cleanup_zombie_jobs", {"p_timeout_minutes": 1}).execute()
    print("    [OK] Cleanup function exists")
except Exception as e:
    err_str = str(e).lower()
    if "not found" in err_str:
        issues.append("Cleanup function missing")
        print("    [MISSING] Cleanup function not found")
    else:
        print("    [OK] Cleanup exists")

# Summary
print("\n" + "=" * 50)
if issues:
    print(f"ISSUES FOUND: {len(issues)}")
    for issue in issues:
        print(f"  - {issue}")
    print("\nRun SQL migration in Supabase SQL Editor to fix.")
else:
    print("[OK] ALL CHECKS PASSED - Infrastructure ready")
print("=" * 50)