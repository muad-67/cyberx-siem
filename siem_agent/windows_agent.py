"""
windows_agent.py
CyberX SIEM — Windows Endpoint Log Agent

Reads Windows Event Log entries using the built-in `win32evtlog` API (pywin32)
and ships them to the SIEM Flask server in the same JSON format as the Linux agent.

Supported Event Sources:
  Security  — login events (4624, 4625, 4648, 4672, 4740)
  System    — service installs (7045), critical errors
  Application — application errors

Installation:
  pip install pywin32 requests
  python windows_agent.py

Run as Administrator for access to the Security event log.
"""

import json
import os
import socket
import time
from datetime import datetime, timedelta, timezone

import requests

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
LOOKBACK_SECS = int(os.environ.get("LOOKBACK_SECS", "60"))
HOSTNAME      = socket.gethostname()


def _get_local_ip() -> str:
    """Return the IP of the outbound network interface (no packets sent)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def _discover_siem_url() -> str:
    """
    Find the SIEM server automatically.
    1. Honour SIEM_URL env var if set.
    2. Try localhost (agent on the same machine as the server).
    3. Scan the local /24 subnet for port 5000.
    """
    if os.environ.get("SIEM_URL"):
        return os.environ["SIEM_URL"].rstrip("/") + "/api/logs"

    candidates = ["http://127.0.0.1:5000"]

    local_ip = _get_local_ip()
    if not local_ip.startswith("127."):
        prefix = ".".join(local_ip.split(".")[:3])
        # Add the gateway (.1) and a few common server addresses first
        priority = [f"http://{prefix}.{n}:5000" for n in (1, 2, 10, 100, 50)]
        rest     = [f"http://{prefix}.{n}:5000" for n in range(1, 255)
                    if f"http://{prefix}.{n}:5000" not in priority
                    and n != int(local_ip.split(".")[-1])]
        candidates += priority + rest

    print("[AGENT] Searching for SIEM server...")
    for base in candidates:
        try:
            r = requests.get(f"{base}/api/health", timeout=1)
            if r.status_code == 200 and r.json().get("service") == "CyberX SIEM":
                print(f"[AGENT] Found SIEM at {base}")
                return f"{base}/api/logs"
        except Exception:
            continue

    # Fall back to localhost if nothing found
    print("[AGENT] SIEM not found on network — falling back to localhost.")
    return "http://127.0.0.1:5000/api/logs"


# ── Configuration ─────────────────────────────────────────────────────────────
SOURCE_IP = os.environ.get("AGENT_IP", _get_local_ip())
SIEM_URL  = _discover_siem_url()

# ── Windows Event ID mappings ─────────────────────────────────────────────────
EVENT_MAP = {
    # Security log
    4624: {"log_type": "windows", "severity": "info",     "desc": "Successful logon"},
    4625: {"log_type": "windows", "severity": "high",     "desc": "Failed logon"},
    4648: {"log_type": "windows", "severity": "high",     "desc": "Logon with explicit credentials"},
    4672: {"log_type": "windows", "severity": "high",     "desc": "Special privileges assigned to logon"},
    4720: {"log_type": "windows", "severity": "high",     "desc": "User account created"},
    4726: {"log_type": "windows", "severity": "high",     "desc": "User account deleted"},
    4740: {"log_type": "windows", "severity": "critical", "desc": "User account locked out"},
    4756: {"log_type": "windows", "severity": "medium",   "desc": "Member added to security-enabled group"},
    # System log
    7045: {"log_type": "windows", "severity": "high",     "desc": "New service installed"},
    7036: {"log_type": "windows", "severity": "info",     "desc": "Service state change"},
    # Application log
    1000: {"log_type": "windows", "severity": "medium",   "desc": "Application error"},
    1001: {"log_type": "windows", "severity": "medium",   "desc": "Application fault"},
}

SOURCES = {
    "Security":    [4624, 4625, 4648, 4672, 4720, 4726, 4740, 4756],
    "System":      [7045, 7036],
    "Application": [1000, 1001],
}


def _format_event(event_id: int, source: str, time_generated, message: str) -> dict:
    """Build the standard SIEM JSON payload for one Windows event."""
    mapping = EVENT_MAP.get(event_id, {
        "log_type": "windows", "severity": "info", "desc": "Windows Event"
    })
    return {
        "timestamp":  datetime.fromtimestamp(
            int(time_generated.timestamp()) if hasattr(time_generated, "timestamp") else time.time(),
            tz=timezone.utc
        ).isoformat(),
        "source_ip":  SOURCE_IP,
        "hostname":   HOSTNAME,
        "log_type":   mapping["log_type"],
        "severity":   mapping["severity"],
        "message":    f"EventID:{event_id} [{mapping['desc']}] Source:{source} | {message[:512]}",
        "raw_data":   json.dumps({
            "event_id": event_id,
            "source":   source,
            "hostname": HOSTNAME,
        }),
    }


def _ship(payload: dict) -> bool:
    """POST one log entry to the SIEM server. Returns True on success."""
    try:
        resp = requests.post(SIEM_URL, json=payload, timeout=5)
        return resp.status_code in (200, 201)
    except Exception as e:
        print(f"[AGENT] Ship error: {e}")
        return False


def collect_and_ship():
    """
    Read new events from Windows Event Log and ship them to the SIEM.
    Uses pywin32's win32evtlog module.
    """
    try:
        import win32evtlog
        import win32evtlogutil
        import pywintypes
    except ImportError:
        print("[AGENT] ERROR: pywin32 not installed. Run: pip install pywin32")
        return

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=LOOKBACK_SECS)
    shipped = 0

    for source_name, event_ids in SOURCES.items():
        try:
            hand = win32evtlog.OpenEventLog(None, source_name)
            flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            events = win32evtlog.ReadEventLog(hand, flags, 0)

            for event in (events or []):
                try:
                    event_time = event.TimeGenerated
                    # Convert pywintypes.datetime to Python datetime if needed
                    if hasattr(event_time, "year"):
                        event_dt = datetime(
                            event_time.year, event_time.month, event_time.day,
                            event_time.hour, event_time.minute, event_time.second
                        )
                    else:
                        continue

                    if event_dt < cutoff:
                        continue  # skip older events on this run

                    eid = event.EventID & 0xFFFF
                    if eid not in event_ids:
                        continue

                    msg = win32evtlogutil.SafeFormatMessage(event, source_name) or ""
                    payload = _format_event(eid, source_name, event_dt, msg)
                    if _ship(payload):
                        shipped += 1

                except Exception:
                    continue

            win32evtlog.CloseEventLog(hand)

        except Exception as e:
            print(f"[AGENT] Could not read {source_name} log: {e}")

    if shipped:
        print(f"[AGENT] Shipped {shipped} Windows events to {SIEM_URL}")


# ── Main loop ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 54)
    print("  CyberX Windows Log Agent")
    print("=" * 54)
    print(f"  SIEM Server : {SIEM_URL}")
    print(f"  Hostname    : {HOSTNAME}")
    print(f"  Source IP   : {SOURCE_IP}")
    print(f"  Poll every  : {POLL_INTERVAL}s")
    print("=" * 54)
    print("  Starting... (Ctrl+C to stop)")

    while True:
        collect_and_ship()
        time.sleep(POLL_INTERVAL)
