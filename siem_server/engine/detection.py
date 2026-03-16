"""
engine/detection.py
Core detection engine — called for every log received.

Flow:
  1. Incoming log arrives at Flask route
  2. Route calls run_detection_on_log(log_data, log_id)
  3. Engine loops through RULES
  4. For matching rules it counts recent DB events from the same IP
  5. If count >= threshold → create alert (with MITRE mapping)
  6. Deduplication prevents alert storms
"""

from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from engine.rules import RULES
from engine.mitre import get_mitre_info
from engine.scoring import compute_risk_score


# ── Helpers ──────────────────────────────────────────────────────────────────

def _keywords_match(message: str, keywords: list) -> bool:
    """Return True if any keyword appears (case-insensitive) in message."""
    msg = message.lower()
    return any(kw.lower() in msg for kw in keywords)


def _time_condition_met(condition: Optional[dict]) -> bool:
    """Return True if the current UTC hour is within the rule's time window."""
    if not condition:
        return True
    hour = datetime.utcnow().hour
    return condition["start_hour"] <= hour < condition["end_hour"]


def _recent_matching_count(source_ip: str, log_type: str,
                           keywords: list, window_seconds: int) -> tuple:
    """
    Count logs from source_ip of log_type matching keywords in the past
    window_seconds. Returns (count, list_of_log_ids).
    """
    since = (datetime.utcnow() - timedelta(seconds=window_seconds)).isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT id, message FROM raw_logs
        WHERE source_ip = ?
          AND log_type  = ?
          AND timestamp >= ?
        ORDER BY timestamp DESC
    """, (source_ip, log_type, since))
    rows = c.fetchall()
    conn.close()

    matching = [r for r in rows if _keywords_match(r["message"], keywords)]
    ids = [r["id"] for r in matching]
    return len(matching), ids


def _alert_already_exists(alert_type: str, source_ip: str,
                          dedup_minutes: int = 5) -> bool:
    """Return True if an identical alert was created in the last dedup_minutes."""
    since = (datetime.utcnow() - timedelta(minutes=dedup_minutes)).isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT id FROM alerts
        WHERE alert_type = ? AND source_ip = ? AND timestamp >= ?
        LIMIT 1
    """, (alert_type, source_ip, since))
    exists = c.fetchone() is not None
    conn.close()
    return exists


def _is_whitelisted(source_ip: str) -> bool:
    """Return True if the IP is on the trusted whitelist."""
    conn = get_db()
    result = conn.execute(
        "SELECT id FROM whitelist WHERE ip_address = ?", (source_ip,)
    ).fetchone()
    conn.close()
    return result is not None


def _create_alert(rule: dict, source_ip: str,
                  log_ids: list, description: str) -> int:
    """Insert an alert record (with risk score) and return its new ID."""
    mitre = get_mitre_info(rule["alert_type"])
    risk_score = compute_risk_score(
        rule["severity"], mitre["tactic"], source_ip, rule["alert_type"]
    )
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO alerts (
            timestamp, alert_type, severity, source_ip,
            description, mitre_tactic, mitre_technique, mitre_name,
            status, log_ids, risk_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    """, (
        datetime.utcnow().isoformat(),
        rule["alert_type"],
        rule["severity"],
        source_ip,
        description,
        mitre["tactic"],
        mitre["technique"],
        mitre["name"],
        ",".join(str(i) for i in log_ids),
        risk_score,
    ))
    alert_id = c.lastrowid
    conn.commit()
    conn.close()

    print(f"[ALERT] {rule['severity'].upper()} | {rule['name']} | IP: {source_ip} "
          f"| MITRE: {mitre['technique']} ({mitre['name']}) | Score: {risk_score}")
    return alert_id


# ── Public API ────────────────────────────────────────────────────────────────

def run_detection_on_log(log_data: dict, log_id: int) -> list[dict]:
    """
    Entry point called by the log ingestion route.
    Checks the incoming log against every rule and creates alerts as needed.
    Returns a list of alert dicts for any alerts created.
    """
    source_ip = log_data.get("source_ip", "")
    log_type  = log_data.get("log_type", "")
    message   = log_data.get("message", "")
    generated = []

    # Skip detection entirely for whitelisted IPs
    if _is_whitelisted(source_ip):
        return generated

    for rule in RULES:
        # Only check rules for the matching log type
        if rule["log_type"] != log_type:
            continue

        # Message must contain at least one rule keyword
        if not _keywords_match(message, rule["keywords"]):
            continue

        # Optional time-of-day condition (e.g. off-hours rules)
        if not _time_condition_met(rule.get("time_condition")):
            continue

        # Count recent matching events from this IP
        count, ids = _recent_matching_count(
            source_ip, log_type, rule["keywords"], rule["window"]
        )

        if count < rule["threshold"]:
            continue

        # Skip if we already fired this alert recently (deduplication)
        if _alert_already_exists(rule["alert_type"], source_ip):
            continue

        description = (
            f"{rule['name']}: {count} matching event(s) from {source_ip} "
            f"within {rule['window']}s. Rule: {rule['id']}."
        )

        alert_id = _create_alert(rule, source_ip, ids, description)
        generated.append({
            "alert_id":   alert_id,
            "alert_type": rule["alert_type"],
            "severity":   rule["severity"],
            "rule":       rule["id"],
        })

    # Run correlation if any alerts were generated
    if generated:
        try:
            from engine.correlation import correlate_and_create_incident
            correlate_and_create_incident(source_ip)
        except Exception as e:
            print(f"[CORRELATOR] Error: {e}")

    return generated
