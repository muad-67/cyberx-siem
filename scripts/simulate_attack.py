"""
scripts/simulate_attack.py
Attack simulator for testing the SIEM pipeline end-to-end.

Sends realistic log sequences to the SIEM server that trigger
each detection rule. Run this while the Flask server is running
and the dashboard is open to see the full flow live.

Usage:
    python simulate_attack.py
    python simulate_attack.py --url http://192.168.1.10:5000/api/logs
"""

import sys
import time
import argparse
import requests
from datetime import datetime

# ── CLI args ──────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="CyberX SIEM attack simulator")
parser.add_argument("--url", default="http://127.0.0.1:5000/api/logs",
                    help="SIEM ingest endpoint")
parser.add_argument("--attacker", default="10.10.10.99",
                    help="Simulated attacker IP")
args = parser.parse_args()

SIEM_URL   = args.url
ATTACKER   = args.attacker
VICTIM     = "192.168.1.20"
HOSTNAME   = "endpoint-vm"


def post(message, log_type="auth", severity="high", source_ip=ATTACKER):
    payload = {
        "timestamp": datetime.utcnow().isoformat(),
        "source_ip": source_ip,
        "hostname":  HOSTNAME,
        "log_type":  log_type,
        "severity":  severity,
        "message":   message,
    }
    try:
        r = requests.post(SIEM_URL, json=payload, timeout=5)
        alerts = r.json().get("alerts_generated", 0) if r.status_code == 201 else 0
        marker = " *** ALERT ***" if alerts else ""
        print(f"  [{r.status_code}]{marker} {message[:80]}")
    except Exception as exc:
        print(f"  [ERR] {exc}")


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ─────────────────────────────────────────────────────────────────────────────

section("ATTACK 1 — SSH Brute Force (triggers R001)")
for i in range(8):
    post(f"Failed password for root from {ATTACKER} port {50000+i} ssh2")
    time.sleep(0.4)
print("  → Expected: brute_force alert (CRITICAL) | MITRE T1110")

time.sleep(2)

section("ATTACK 2 — Root Login (triggers R003)")
post(f"Accepted password for root from {ATTACKER} port 50010 ssh2")
post(f"pam_unix(sshd:session): session opened for user root by (uid=0)")
print("  → Expected: privilege_escalation alert (HIGH) | MITRE T1548")

time.sleep(2)

section("ATTACK 3 — New Backdoor Account (triggers R004)")
post("useradd: new user: name=backdoor, UID=1337, GID=1337, home=/home/backdoor")
print("  → Expected: persistence alert (HIGH) | MITRE T1136")

time.sleep(2)

section("ATTACK 4 — Port Scan (triggers R006)")
for port in range(20, 35):
    post(
        f"connection attempt to port {port} from {ATTACKER} refused",
        log_type="network",
        severity="medium",
    )
    time.sleep(0.1)
print("  → Expected: port_scan alert (MEDIUM) | MITRE T1046")

time.sleep(2)

section("ATTACK 5 — Sudo Escalation (triggers R005)")
post(f"sudo: root : TTY=pts/0 ; PWD=/root ; USER=root ; COMMAND=/bin/bash")
print("  → Expected: privilege_escalation alert (MEDIUM) | MITRE T1548")

time.sleep(2)

section("ATTACK 6 — Successful Login After Brute Force (triggers R002)")
post(f"Accepted password for admin from {ATTACKER} port 50099 ssh2")
post(f"pam_unix(sshd:session): session opened for user admin by (uid=1000)")
print("  → Expected: suspicious_login alert (CRITICAL) | MITRE T1078")

section("SIMULATION COMPLETE")
print(f"  Check the dashboard at http://localhost:3000")
print(f"  Or query alerts: GET {SIEM_URL.replace('/api/logs','/api/alerts')}")
