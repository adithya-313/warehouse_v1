import requests
import json
import time

BASE_URL = "http://localhost:3001/api/supplier-risk"

print("========================================")
print("TESTING SUPPLIER RISK DASHBOARD APIs")
print("========================================")

# 1. Test GET /all
print("\n[GET] /all")
res_all = requests.get(f"{BASE_URL}/all")
print(f"Status: {res_all.status_code}")
if res_all.status_code != 200:
    print(f"Failed array fetch: {res_all.text}")
    exit(1)

all_data = res_all.json()
print(f"Found {len(all_data)} suppliers.")

# Get a valid ID, or fallback
supplier_id = "b3000000-0000-0000-0000-000000000001"
if len(all_data) > 0:
    supplier_id = all_data[0].get("supplier_id", supplier_id)

print(f"Using supplier_id: {supplier_id}")

# 2. Test GET /[id]
print(f"\n[GET] /{supplier_id}")
res_single = requests.get(f"{BASE_URL}/{supplier_id}")
print(f"Status: {res_single.status_code}")
print(f"Response: {json.dumps(res_single.json(), indent=2)[:300]}...")

# 3. Test GET /alerts
print("\n[GET] /alerts")
res_alerts = requests.get(f"{BASE_URL}/alerts")
print(f"Status: {res_alerts.status_code}")
print(f"Response Size: {len(res_alerts.json())} alerts found")

# 4. Test POST /calculate
print("\n[POST] /calculate")
res_calc = requests.post(f"{BASE_URL}/calculate", json={"supplier_id": supplier_id})
print(f"Status: {res_calc.status_code}")
print(f"Response: {json.dumps(res_calc.json(), indent=2)[:300]}...")

# 5. Test POST /predict
print("\n[POST] /predict")
res_pred = requests.post(f"{BASE_URL}/predict", json={"supplier_id": supplier_id})
print(f"Status: {res_pred.status_code}")
print(f"Response: {json.dumps(res_pred.json(), indent=2)[:300]}...")

# 6. Test POST /assess
print("\n[POST] /assess")
res_assess = requests.post(f"{BASE_URL}/assess", json={"supplier_id": supplier_id})
print(f"Status: {res_assess.status_code}")
print(f"Response: {json.dumps(res_assess.json(), indent=2)[:300]}...")

# 7. Test Missing ID Error logic
print("\n[POST] /assess (Missing Data Test)")
res_err = requests.post(f"{BASE_URL}/assess", json={})
print(f"Status (Expected 400): {res_err.status_code}")
