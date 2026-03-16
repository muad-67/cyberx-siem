"""
agent.py
CyberX SIEM Endpoint Agent.

Runs on the Endpoint VM. Tails log files in real-time and ships
each new line to the SOC server via HTTP POST (JSON).

Usage:
    sudo python3 agent.py

On Linux  the default log paths point at /var/log/auth.log etc.
On Windows the agent uses Windows Event Log via the win32evtlog API
when running in Windows mode (set PLATFORM = 'windows' below).
"""

import os
import sys
import json
import time
import socket
import requests
from datetime import datetime

# ── Configuration ─────────────────────────────────────────────────────────────
SIEM_URL      = "http://172.22.208.65:5000/api/logs"   # SOC Server IP:Port
SOURCE_IP     = "172.22.208.65"                         # This machine's IP
HOSTNAME      = socket.gethostname()
POLL_INTERVAL = 5                                       # seconds between log checks

# OS-aware paths
if sys.platform == "win32":
    STATE_FILE = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "cyberx_agent_state.json")
    LOG_SOURCES = {}   # Windows has no flat log files — use windows_agent.py instead
else:
    STATE_FILE = "/tmp/cyberx_agent_state.json"
    LOG_SOURCES = {
        "/var/log/auth.log":  "auth",
        "/var/log/syslog":    "syslog",
        "/var/log/kern.log":  "kernel",
    }

# ── Severity classification ────────────────────────────────────────────────────

_HIGH_KEYWORDS    = ["failed password", "authentication failure", "invalid user",
                     "connection closed by invalid user", "error", "denied"]
_MEDIUM_KEYWORDS  = ["accepted password", "session opened for user root",
                     "sudo:", "warning", "warn"]
_CRITICAL_KEYWORDS = ["attack", "emergency", "critical"]


def classify_severity(message: str) -> str:
    m = message.lower()
    if any(k in m for k in _CRITICAL_KEYWORDS):
        return "critical"
    if any(k in m for k in _HIGH_KEYWORDS):
        return "high"
    if any(k in m for k in _MEDIUM_KEYWORDS):
        return "medium"
    return "info"


# ── State persistence ─────────────────────────────────────────────────────────

def load_state() -> dict:
    """Load file-position state from disk so restarts don't re-ship old logs."""
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


# ── Log shipping ──────────────────────────────────────────────────────────────

def send_log(log_type: str, message: str) -> bool:
    """POST a single log line to the SIEM server. Returns True on success."""
    payload = {
        "timestamp": datetime.utcnow().isoformat(),
        "source_ip": SOURCE_IP,
        "hostname":  HOSTNAME,
        "log_type":  log_type,
        "severity":  classify_severity(message),
        "message":   message,
    }
    try:
        r = requests.post(SIEM_URL, json=payload, timeout=8)
        if r.status_code == 201:
            alerts = r.json().get("alerts_generated", 0)
            tag = f" [{alerts} alert(s)]" if alerts else ""
            print(f"[{log_type.upper()}]{tag} {message[:80]}")
            return True
        print(f"[WARN] Server returned {r.status_code}")
        return False
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot reach SIEM at {SIEM_URL}")
        return False
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return False


# ── File tailing ──────────────────────────────────────────────────────────────

def tail_file(filepath: str, log_type: str, state: dict) -> dict:
    """Read new lines from filepath since the last known byte position."""
    if not os.path.exists(filepath):
        return state   # file doesn't exist yet — skip silently

    size = os.path.getsize(filepath)
    last = state.get(filepath, 0)

    # Handle log rotation (file shrank)
    if size < last:
        print(f"[ROTATE] {filepath}")
        last = 0

    if size == last:
        return state   # nothing new

    with open(filepath, "r", errors="replace") as fh:
        fh.seek(last)
        for line in fh:
            line = line.strip()
            if line:
                send_log(log_type, line)
        state[filepath] = fh.tell()

    return state


# ── Main loop ─────────────────────────────────────────────────────────────────

def run():
    print("=" * 54)
    print("  CyberX SIEM Agent")
    print(f"  Hostname : {HOSTNAME}")
    print(f"  Source IP: {SOURCE_IP}")
    print(f"  SIEM URL : {SIEM_URL}")
    print(f"  Watching : {list(LOG_SOURCES.keys())}")
    print("=" * 54)

    state = load_state()

    while True:
        for path, log_type in LOG_SOURCES.items():
            state = tail_file(path, log_type, state)
        save_state(state)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    if sys.platform == "win32" and not LOG_SOURCES:
        print("=" * 54)
        print("  This machine is running Windows.")
        print("  Use windows_agent.py instead:")
        print("    python windows_agent.py")
        print("=" * 54)
        sys.exit(0)
    run()
