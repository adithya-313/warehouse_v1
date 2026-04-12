import requests

endpoints = [
    ("POST", "http://localhost:3001/api/demand-forecast/single"),
    ("GET", "http://localhost:3001/api/demand-trends"),
    ("GET", "http://localhost:3001/api/liquidation-recommendations"),
    ("POST", "http://localhost:3001/api/liquidation-recommendations/test/acknowledge"),
    ("GET", "http://localhost:3001/api/overstock-analysis"),
    ("GET", "http://localhost:3001/api/supplier-orders"),
    ("GET", "http://localhost:3001/api/supplier-orders/test/receive"),
    ("GET", "http://localhost:3001/api/supplier-performance/low-performers"),
    ("GET", "http://localhost:3001/api/suppliers"),
    ("GET", "http://localhost:3001/api/suppliers/test"),
    ("GET", "http://localhost:3001/api/suppliers/test/performance"),
    ("POST", "http://localhost:3001/api/sync/trigger"),
]

for method, url in endpoints:
    try:
        if method == "GET":
            res = requests.get(url, json={}) # Empty body even for get
        else:
            res = requests.post(url, json={}) # Missing required args will trigger robust errors
        try:
            body = res.json()
            is_json = True
        except:
            body = res.text
            is_json = False
        print(f"[{method}] {url.split('/api/')[-1]} -> STATUS: {res.status_code} | IS_JSON: {is_json} | ERROR_MSG: {body.get('error') if isinstance(body, dict) else 'N/A'}")
    except Exception as e:
        print(f"[{method}] {url.split('/api/')[-1]} -> FAIL: {e}")
