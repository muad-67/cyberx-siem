"""
engine/correlation.py
Alert correlation engine for CyberX SIEM.

If a source IP triggers 2+ different alert types within the correlation
window, an incident is automatically created to group them as an attack chain.
"""

from __future__ import annotations
from datetime import datetime, timedelta
from database import get_db
from config import Config


def correlate_and_create_incident(source_ip: str) -> int | None:
    """
    Check if source_ip has triggered multiple distinct alert types recently.
    If so, create (or update) a correlated incident.
    Returns the incident ID if one was created, else None.
    """
    window_minutes = getattr(Config, "CORRELATION_WINDOW_MINUTES", 10)
    since = (datetime.utcnow() - timedelta(minutes=window_minutes)).isoformat()

    conn = get_db()

    # Get recent open alerts from this IP, grouped by type
    rows = conn.execute("""
        SELECT id, alert_type, severity, mitre_tactic, mitre_technique
        FROM alerts
        WHERE source_ip = ?
          AND created_at >= ?
          AND status = 'open'
        ORDER BY created_at
    """, (source_ip, since)).fetchall()

    if not rows:
        conn.close()
        return None

    alert_types = list({r["alert_type"] for r in rows})
    if len(alert_types) < 2:
        conn.close()
        return None

    # Check if an auto-incident already exists for this IP in this window
    existing = conn.execute("""
        SELECT id FROM incidents
        WHERE assigned_to = 'AUTO-CORRELATOR'
          AND created_at >= ?
          AND title LIKE ?
    """, (since, f"%{source_ip}%")).fetchone()

    if existing:
        # Update existing incident's alert list
        incident_id = existing["id"]
        all_ids = ",".join(str(r["id"]) for r in rows)
        conn.execute(
            "UPDATE incidents SET alert_ids = ?, updated_at = ? WHERE id = ?",
            (all_ids, datetime.utcnow().isoformat(), incident_id),
        )
        conn.commit()
        conn.close()
        return incident_id

    # Determine incident severity (highest among correlated alerts)
    _sev_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
    highest_sev = max(rows, key=lambda r: _sev_order.get(r["severity"], 0))["severity"]

    alert_ids_str = ",".join(str(r["id"]) for r in rows)
    tactics = list({r["mitre_tactic"] for r in rows if r["mitre_tactic"]})
    tactics_str = ", ".join(tactics)
    type_str = ", ".join(alert_types)

    title = f"[AUTO] Attack Chain from {source_ip}: {type_str}"
    description = (
        f"Automated correlation detected {len(rows)} alerts of {len(alert_types)} types "
        f"from {source_ip} within {window_minutes} minutes. "
        f"MITRE tactics observed: {tactics_str}. "
        f"Alert IDs: {alert_ids_str}."
    )

    conn.execute("""
        INSERT INTO incidents (title, description, severity, status, alert_ids, assigned_to)
        VALUES (?, ?, ?, 'open', ?, 'AUTO-CORRELATOR')
    """, (title, description, highest_sev, alert_ids_str))
    incident_id = conn.execute(
        "SELECT last_insert_rowid()"
    ).fetchone()[0]
    conn.commit()
    conn.close()

    print(f"[CORRELATOR] Auto-incident #{incident_id} created for {source_ip} "
          f"({len(alert_types)} alert types, severity: {highest_sev})")
    return incident_id
