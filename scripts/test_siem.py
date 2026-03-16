"""
scripts/test_siem.py
Automated test suite for the CyberX SIEM API.

Verifies log ingestion, detection, alerting, MITRE mapping,
IP blocking, and all statistics endpoints.

Usage:
    python test_siem.py
    python test_siem.py --url http://192.168.1.10:5000
"""

import sys
import time
import argparse
import requests

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:5000")
args = parser.parse_args()

BASE = args.url.rstrip("/")
PASS = FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        print(f"  [PASS] {name}")
        PASS += 1
    else:
        print(f"  [FAIL] {name}{f'  ({detail})' if detail else ''}")
        FAIL += 1


def get(path, **kw):
    return requests.get(f"{BASE}{path}", timeout=5, **kw)


def post(path, **kw):
    return requests.post(f"{BASE}{path}", timeout=5, **kw)


def put(path, **kw):
    return requests.put(f"{BASE}{path}", timeout=5, **kw)


# ── 1. Health ─────────────────────────────────────────────────────────────────
print("\n[1] Server health")
try:
    r = get("/api/health")
    check("Server reachable",       r.status_code == 200)
    check("Returns JSON with status", r.json().get("status") == "ok")
except Exception as e:
    check("Server reachable", False, str(e))
    print("\n  Cannot reach server. Is it running?  python app.py")
    sys.exit(1)

# ── 2. Log ingestion ──────────────────────────────────────────────────────────
print("\n[2] Log ingestion")
r = post("/api/logs", json={
    "source_ip": "10.0.0.1",
    "hostname":  "test-host",
    "log_type":  "auth",
    "message":   "Test log from test suite",
})
check("POST /api/logs -> 201",         r.status_code == 201)
check("Response has log_id",          "log_id" in r.json())

r_bad = post("/api/logs", json={"source_ip": "1.2.3.4"})
check("Missing fields -> 400",         r_bad.status_code == 400)

r_bad2 = post("/api/logs", json={
    "source_ip": "999.999.999.999",
    "log_type": "auth",
    "message": "bad ip test",
})
check("Invalid IP -> 400",             r_bad2.status_code == 400)

# ── 3. Log retrieval ──────────────────────────────────────────────────────────
print("\n[3] Log retrieval")
r = get("/api/logs")
check("GET /api/logs -> 200",          r.status_code == 200)
check("Returns list",                 isinstance(r.json(), list))

r = get("/api/logs/count")
check("GET /api/logs/count -> 200",    r.status_code == 200)
check("Has 'total' key",              "total" in r.json())

# ── 4. Detection engine ───────────────────────────────────────────────────────
print("\n[4] Brute-force detection")
attacker = "10.88.88.88"
for i in range(6):
    post("/api/logs", json={
        "source_ip": attacker,
        "hostname":  "victim",
        "log_type":  "auth",
        "message":   f"Failed password for root from {attacker} port {22000+i} ssh2",
    })
time.sleep(0.5)

r = get("/api/alerts")
alerts = r.json()
check("GET /api/alerts -> 200",        r.status_code == 200)
bf = [a for a in alerts if a["alert_type"] == "brute_force" and a["source_ip"] == attacker]
check("Brute-force alert created",    len(bf) > 0,
      f"found {len(bf)} brute_force alerts for {attacker}")

if bf:
    a = bf[0]
    check("Alert has MITRE technique", bool(a.get("mitre_technique")))
    check("Alert has severity",        bool(a.get("severity")))
    check("Alert status = 'open'",     a.get("status") == "open")
    check("MITRE technique = T1110",   a.get("mitre_technique") == "T1110")

# ── 5. Alert status update ────────────────────────────────────────────────────
print("\n[5] Alert management")
if bf:
    aid = bf[0]["id"]
    r = put(f"/api/alerts/{aid}/status", json={"status": "investigating"})
    check("PUT /api/alerts/<id>/status -> 200", r.status_code == 200)

    r2 = get("/api/alerts")
    updated = next((a for a in r2.json() if a["id"] == aid), None)
    check("Status updated to investigating",
          updated and updated["status"] == "investigating")

    r3 = put(f"/api/alerts/{aid}/status", json={"status": "bad_value"})
    check("Invalid status -> 400", r3.status_code == 400)

# ── 6. IP blocking ────────────────────────────────────────────────────────────
print("\n[6] Incident response (IP block)")
r = post("/api/response/block-ip", json={
    "ip_address": "10.99.99.11",
    "reason": "Test block",
})
check("POST /api/response/block-ip -> 201", r.status_code == 201)

r2 = get("/api/response/blocked-ips")
found = any(b["ip_address"] == "10.99.99.11" for b in r2.json())
check("IP appears in blocked list", found)

# duplicate block
r3 = post("/api/response/block-ip", json={"ip_address": "10.99.99.11"})
check("Duplicate block -> 409", r3.status_code == 409)

# ── 7. Statistics ─────────────────────────────────────────────────────────────
print("\n[7] Statistics endpoints")
for ep in ("/api/stats/overview", "/api/stats/top-ips",
           "/api/stats/alerts-by-type", "/api/stats/hourly-logs"):
    r = get(ep)
    check(f"GET {ep} -> 200", r.status_code == 200)

# ── 8. MITRE endpoints ───────────────────────────────────────────────────────
print("\n[8] MITRE ATT&CK")
r = get("/api/mitre/summary")
check("GET /api/mitre/summary -> 200",    r.status_code == 200)
r = get("/api/mitre/techniques")
check("GET /api/mitre/techniques -> 200", r.status_code == 200)
check("Returns >= 5 techniques",          len(r.json()) >= 5)

# ── 9. Incident report ────────────────────────────────────────────────────────
print("\n[9] Incident report")
if bf:
    r = get(f"/api/report/incident/{bf[0]['id']}")
    check("GET /api/report/incident/<id> -> 200", r.status_code == 200)
    body = r.json()
    check("Report has mitre_attack section",  "mitre_attack" in body)
    check("Report has recommendations",       "recommended_actions" in body)

r404 = get("/api/report/incident/999999")
check("Non-existent alert -> 404", r404.status_code == 404)

# ── Summary ───────────────────────────────────────────────────────────────────
total = PASS + FAIL
print(f"\n{'='*54}")
print(f"  Results: {PASS}/{total} passed", end="")
if FAIL:
    print(f"  |  {FAIL} FAILED")
else:
    print("  -- ALL PASSED")
print(f"{'='*54}\n")
sys.exit(0 if FAIL == 0 else 1)
