"""
mac_agent.py
CyberX SIEM — macOS Endpoint Log Agent

Reads the macOS unified log (`/usr/bin/log show`) for security-relevant events
(sudo, ssh, su, login/authentication) and ships them to the SIEM server in the
same JSON format as the Linux and Windows agents.

Usage:
  pip3 install requests
  python3 mac_agent.py

Some events (e.g. sudo, sshd) need root to be visible:
  sudo python3 mac_agent.py

Environment variables:
  SIEM_URL       Base URL of the server, e.g. http://127.0.0.1:5001
  AGENT_IP       Override the source IP reported to the SIEM
  POLL_INTERVAL  Seconds between polls (default 10)
  LOOKBACK_SECS  How far back the first poll looks (default 60)
"""

import json
import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone

import requests

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
LOOKBACK_SECS = int(os.environ.get("LOOKBACK_SECS", "60"))
HOSTNAME      = socket.gethostname()
LOG_BIN       = "/usr/bin/log"

PREDICATE = (
    'process == "sudo" OR process == "sshd" OR process == "su" '
    'OR process == "authd" '
    'OR (process == "loginwindow" AND eventMessage CONTAINS[c] "authenticat")'
)

# Keyword -> severity (checked in order, first match wins)
_SEVERITY_RULES = [
    ("critical", ["account locked", "too many authentication"]),
    ("high",     ["failed password", "authentication failure", "authentication failed",
                  "invalid user", "incorrect password", "not in the sudoers",
                  "denied", "failed"]),
    ("medium",   ["sudo", "command=", "accepted", "session opened", "su:"]),
]


def classify_severity(message: str) -> str:
    m = message.lower()
    for severity, keywords in _SEVERITY_RULES:
        if any(k in m for k in keywords):
            return severity
    return "info"


def _get_local_ip() -> str:
    """IP of the outbound interface (no packets sent)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def _discover_siem_url() -> str:
    """SIEM_URL env var, else probe localhost on ports 5001-5010 (run_mac.sh range) then 5000."""
    if os.environ.get("SIEM_URL"):
        return os.environ["SIEM_URL"].rstrip("/") + "/api/logs"

    print("[AGENT] Searching for SIEM server...")
    for port in (*range(5001, 5011), 5000):
        base = f"http://127.0.0.1:{port}"
        try:
            r = requests.get(f"{base}/api/health", timeout=1)
            if r.status_code == 200 and r.json().get("service") == "CyberX SIEM":
                print(f"[AGENT] Found SIEM at {base}")
                return f"{base}/api/logs"
        except Exception:
            continue

    print("[AGENT] SIEM not found — falling back to http://127.0.0.1:5001")
    return "http://127.0.0.1:5001/api/logs"


SOURCE_IP = os.environ.get("AGENT_IP") or _get_local_ip()
SIEM_URL  = None   # resolved in main() so importing this module has no side effects


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_event(line: str):
    """Turn one ndjson line from `log show` into a SIEM payload, or None to skip."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        ev = json.loads(line)
    except json.JSONDecodeError:
        return None

    message = (ev.get("eventMessage") or "").strip()
    if not message:
        return None

    process = os.path.basename(ev.get("processImagePath") or "unknown")
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_ip": SOURCE_IP,
        "hostname":  HOSTNAME,
        "log_type":  "auth" if process in ("sudo", "sshd", "su", "authd", "loginwindow") else "syslog",
        "severity":  classify_severity(message),
        "message":   f"{process}: {message}"[:1024],
        "raw_data":  json.dumps({"process": process, "mach": ev.get("machTimestamp")}),
    }, (ev.get("machTimestamp"), ev.get("traceID"), message)


# ── Collection ────────────────────────────────────────────────────────────────

def read_events(seconds: int) -> list:
    """Run `log show` for the last N seconds; returns raw ndjson lines."""
    cmd = [LOG_BIN, "show", "--last", f"{max(seconds, 1)}s",
           "--style", "ndjson", "--predicate", PREDICATE]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        print(f"[AGENT] ERROR: {LOG_BIN} not found — this agent only runs on macOS.")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("[AGENT] `log show` timed out; will retry")
        return []
    if out.returncode != 0:
        print(f"[AGENT] `log show` failed: {out.stderr.strip()[:200]}")
        return []
    return out.stdout.splitlines()


def _ship(payload: dict) -> bool:
    try:
        r = requests.post(SIEM_URL, json=payload, timeout=5)
        return r.status_code in (200, 201)
    except Exception as e:
        print(f"[AGENT] Ship error: {e}")
        return False


def collect_and_ship(seen: set, window: int) -> int:
    """One poll. `seen` de-duplicates events across overlapping windows."""
    shipped = 0
    for line in read_events(window):
        parsed = parse_event(line)
        if not parsed:
            continue
        payload, key = parsed
        if key in seen:
            continue
        if _ship(payload):
            seen.add(key)       # only mark as seen once delivered, so failures retry
            shipped += 1
    if shipped:
        print(f"[AGENT] Shipped {shipped} macOS events to {SIEM_URL}")
    return shipped


def main():
    global SIEM_URL
    if sys.platform != "darwin":
        print("mac_agent.py only runs on macOS. Use agent.py (Linux) or windows_agent.py (Windows).")
        sys.exit(1)

    SIEM_URL = _discover_siem_url()
    print("=" * 54)
    print("  CyberX macOS Log Agent")
    print("=" * 54)
    print(f"  SIEM Server : {SIEM_URL}")
    print(f"  Hostname    : {HOSTNAME}")
    print(f"  Source IP   : {SOURCE_IP}")
    print(f"  Poll every  : {POLL_INTERVAL}s")
    if os.geteuid() != 0:
        print("  NOTE: not root — some sudo/ssh events may be hidden. Use: sudo python3 mac_agent.py")
    print("=" * 54)
    print("  Starting... (Ctrl+C to stop)")

    seen: set = set()
    window = LOOKBACK_SECS
    while True:
        started = time.time()
        collect_and_ship(seen, window)
        # Overlap the next window slightly; `seen` removes duplicates.
        window = int(POLL_INTERVAL + (time.time() - started)) + 5
        if len(seen) > 5000:
            seen.clear()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[AGENT] Stopped.")
