"""
engine/scoring.py
Threat risk scoring for CyberX SIEM alerts.

Computes a 0-100 risk score for each alert based on:
  - Severity weight (40 pts max)
  - MITRE tactic weight (25 pts max)
  - Alert frequency from same IP (20 pts max)
  - Whether IP is on the watchlist (15 pts bonus)
"""

from __future__ import annotations
from datetime import datetime, timedelta
from database import get_db

# ── Severity weights (0–40) ───────────────────────────────────────────────────
_SEVERITY_SCORES = {
    "critical": 40,
    "high":     30,
    "medium":   18,
    "low":      8,
    "info":     2,
}

# ── MITRE tactic weights (0–25) ───────────────────────────────────────────────
# Higher-impact tactics score more points.
_TACTIC_SCORES = {
    "Execution":            25,
    "Credential Access":    22,
    "Privilege Escalation": 22,
    "Defense Evasion":      20,
    "Command and Control":  20,
    "Lateral Movement":     20,
    "Persistence":          18,
    "Initial Access":       15,
    "Reconnaissance":       10,
    "Unknown":               5,
}


def compute_risk_score(
    severity: str,
    mitre_tactic: str,
    source_ip: str,
    alert_type: str,
) -> int:
    """
    Calculate a 0-100 risk score for an alert.
    Returns an integer clamped to [0, 100].
    """
    score = 0

    # ── 1. Severity (0–40) ────────────────────────────────────────────
    score += _SEVERITY_SCORES.get(severity, 5)

    # ── 2. MITRE tactic weight (0–25) ────────────────────────────────
    score += _TACTIC_SCORES.get(mitre_tactic, 5)

    # ── 3. Frequency bonus — same IP alerts in last 24h (0–20) ───────
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    conn = get_db()
    freq = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE source_ip = ? AND created_at >= ?",
        (source_ip, since),
    ).fetchone()[0]

    # Each previous alert from this IP adds 2 points, capped at 20
    score += min(freq * 2, 20)

    # ── 4. Watchlist bonus (0–15) ─────────────────────────────────────
    on_watchlist = conn.execute(
        "SELECT id FROM watchlist WHERE ip_address = ?", (source_ip,)
    ).fetchone()
    conn.close()

    if on_watchlist:
        score += 15

    return min(score, 100)
