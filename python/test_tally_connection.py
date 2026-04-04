"""
test_tally_connection.py — Quick Tally connectivity check.
Run this FIRST if sync_agent.py fails silently.

Usage:  python test_tally_connection.py
"""

import os
import socket
import httpx
from dotenv import load_dotenv

load_dotenv()

TALLY_HOST = os.getenv("TALLY_HOST", "localhost")
TALLY_PORT = int(os.getenv("TALLY_PORT", "9000"))

MINIMAL_XML = """<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>"""

print(f"\n🔍 Testing Tally connection at {TALLY_HOST}:{TALLY_PORT}")
print("-" * 50)

# --- TCP port check ---
try:
    sock = socket.create_connection((TALLY_HOST, TALLY_PORT), timeout=5)
    sock.close()
    print(f"✔  TCP port {TALLY_PORT} is OPEN")
except (socket.timeout, ConnectionRefusedError, OSError) as e:
    print(f"✘  TCP port {TALLY_PORT} is CLOSED or unreachable: {e}")
    print("\n💡 Tip: Make sure Tally ERP is running and XML gateway is enabled.")
    print("       sync_agent.py will automatically fall back to CSV upload.")
    exit(1)

# --- HTTP XML request ---
try:
    resp = httpx.post(
        f"http://{TALLY_HOST}:{TALLY_PORT}",
        content=MINIMAL_XML,
        headers={"Content-Type": "text/xml"},
        timeout=10.0,
    )
    print(f"✔  HTTP response: {resp.status_code}")
    if resp.status_code == 200:
        print("✔  Tally is reachable and responding to XML requests.")
        print("\n🎉 Connection successful — sync_agent.py should work correctly.")
    else:
        print(f"⚠  Unexpected HTTP status: {resp.status_code}")
        print("   Response:", resp.text[:200])
except Exception as e:
    print(f"✘  HTTP request failed: {e}")
    print("\n💡 Port is open but Tally rejected the request.")
    print("   Check that XML gateway is enabled in Tally (F12 → Advanced Config).")
    exit(1)
