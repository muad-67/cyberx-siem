"""
routes/report.py
Report generation for CyberX SIEM.

GET  /api/report/incident/<id>  — structured report for a given alert
GET  /api/reports/daily         — daily threat summary (?days=1)
GET  /api/reports/weekly        — 7-day trend summary
GET  /api/reports/export        — export alerts as JSON or CSV (?format=csv)
GET  /api/admin/storage         — DB storage stats (admin)
"""

import csv
import io
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, Response
from database import get_db

report_bp = Blueprint("report", __name__)

_RECOMMENDATIONS = {
    "brute_force": [
        "Block the source IP immediately via the Response panel.",
        "Check if any login succeeded from this IP.",
        "Review /var/log/auth.log on the target endpoint.",
        "Consider deploying fail2ban on endpoints.",
    ],
    "suspicious_login": [
        "Verify the login was authorised with the account owner.",
        "Inspect shell history on the compromised account.",
        "Check for lateral movement to other hosts.",
        "Reset credentials if compromise is confirmed.",
    ],
    "port_scan": [
        "Block the scanning IP.",
        "Review which services are exposed on the scanned host.",
        "Check for follow-up exploitation attempts.",
    ],
    "privilege_escalation": [
        "Review the sudo command that was executed.",
        "Audit /etc/sudoers for unnecessary permissions.",
        "Check for follow-up malicious commands in shell history.",
    ],
    "persistence": [
        "Remove the backdoor account immediately.",
        "Audit all user accounts on the affected system.",
        "Check for scheduled tasks or cron jobs added by the attacker.",
    ],
}


@report_bp.route("/api/report/incident/<int:alert_id>", methods=["GET"])
def incident_report(alert_id):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM alerts WHERE id = ?", (alert_id,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Alert not found"}), 404

    alert = dict(row)

    # Fetch the triggering log messages
    log_ids = [int(x) for x in alert.get("log_ids", "").split(",") if x.strip().isdigit()]
    sample_logs = []
    if log_ids:
        placeholders = ",".join("?" * len(log_ids))
        logs = conn.execute(
            f"SELECT message FROM raw_logs WHERE id IN ({placeholders})", log_ids
        ).fetchall()
        sample_logs = [r["message"] for r in logs[:5]]

    # Check if the IP is already blocked
    block = conn.execute(
        "SELECT created_at FROM blocked_ips WHERE ip_address = ?",
        (alert["source_ip"],),
    ).fetchone()
    conn.close()

    report = {
        "report_metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "report_type":  "Incident Report",
            "system":       "CyberX Lightweight SIEM",
        },
        "incident_summary": {
            "alert_id":   alert_id,
            "alert_type": alert["alert_type"],
            "severity":   alert["severity"],
            "status":     alert["status"],
            "detected_at": alert["timestamp"],
        },
        "threat_intelligence": {
            "source_ip":  alert["source_ip"],
            "ip_blocked": block is not None,
            "blocked_at": dict(block)["created_at"] if block else None,
        },
        "mitre_attack": {
            "tactic":         alert["mitre_tactic"],
            "technique":      alert["mitre_technique"],
            "technique_name": alert["mitre_name"],
            "reference":      f"https://attack.mitre.org/techniques/{alert['mitre_technique']}/",
        },
        "description": alert["description"],
        "evidence": {
            "log_count":   len(log_ids),
            "sample_logs": sample_logs,
        },
        "recommended_actions": _RECOMMENDATIONS.get(
            alert["alert_type"],
            ["Investigate manually and document findings."],
        ),
    }
    return jsonify(report)


# ── Daily Report ──────────────────────────────────────────────────────────────

@report_bp.route("/api/reports/daily", methods=["GET"])
def daily_report():
    """
    Daily threat summary. Accepts ?days=N (default 1) to look back N days.
    Returns alert counts, top IPs, severity breakdown, and top MITRE techniques.
    """
    days = int(request.args.get("days", 1))
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    conn = get_db()

    # Total alerts in period
    total_alerts = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE created_at >= ?", (since,)
    ).fetchone()[0]

    # Severity breakdown
    sev_rows = conn.execute("""
        SELECT severity, COUNT(*) as count FROM alerts
        WHERE created_at >= ? GROUP BY severity
    """, (since,)).fetchall()
    severity_breakdown = {r["severity"]: r["count"] for r in sev_rows}

    # Top 5 attacking IPs
    top_ips = conn.execute("""
        SELECT source_ip, COUNT(*) as count FROM alerts
        WHERE created_at >= ? GROUP BY source_ip ORDER BY count DESC LIMIT 5
    """, (since,)).fetchall()

    # Alert type distribution
    type_rows = conn.execute("""
        SELECT alert_type, COUNT(*) as count FROM alerts
        WHERE created_at >= ? GROUP BY alert_type ORDER BY count DESC
    """, (since,)).fetchall()

    # MITRE techniques observed
    mitre_rows = conn.execute("""
        SELECT mitre_technique, mitre_name, mitre_tactic, COUNT(*) as count
        FROM alerts WHERE created_at >= ?
        GROUP BY mitre_technique ORDER BY count DESC LIMIT 10
    """, (since,)).fetchall()

    # Total logs ingested
    total_logs = conn.execute(
        "SELECT COUNT(*) FROM raw_logs WHERE created_at >= ?", (since,)
    ).fetchone()[0]

    # Open vs resolved
    status_rows = conn.execute("""
        SELECT status, COUNT(*) as count FROM alerts
        WHERE created_at >= ? GROUP BY status
    """, (since,)).fetchall()
    status_breakdown = {r["status"]: r["count"] for r in status_rows}

    conn.close()

    return jsonify({
        "report_metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "report_type":  "Daily Threat Summary",
            "period_days":  days,
            "since":        since,
        },
        "summary": {
            "total_alerts":       total_alerts,
            "total_logs":         total_logs,
            "severity_breakdown": severity_breakdown,
            "status_breakdown":   status_breakdown,
        },
        "top_attacking_ips": [dict(r) for r in top_ips],
        "alert_types":        [dict(r) for r in type_rows],
        "mitre_techniques":   [dict(r) for r in mitre_rows],
    })


# ── Weekly Report ─────────────────────────────────────────────────────────────

@report_bp.route("/api/reports/weekly", methods=["GET"])
def weekly_report():
    """
    7-day trend: returns per-day alert counts for charting.
    """
    conn = get_db()
    trend = []
    for i in range(6, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        day_end = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=23, minute=59, second=59
        ).isoformat()
        count = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE created_at >= ? AND created_at <= ?",
            (day_start, day_end),
        ).fetchone()[0]
        logs = conn.execute(
            "SELECT COUNT(*) FROM raw_logs WHERE created_at >= ? AND created_at <= ?",
            (day_start, day_end),
        ).fetchone()[0]
        trend.append({
            "date":   (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d"),
            "alerts": count,
            "logs":   logs,
        })
    conn.close()
    return jsonify({
        "report_metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "report_type":  "Weekly Trend",
        },
        "daily_trend": trend,
    })


# ── Export ────────────────────────────────────────────────────────────────────

@report_bp.route("/api/reports/export", methods=["GET"])
def export_report():
    """
    Export alerts as JSON or CSV.
    Query params: ?format=csv|json  ?days=N (default 7)  ?severity=critical
    """
    fmt      = request.args.get("format", "json").lower()
    days     = int(request.args.get("days", 7))
    severity = request.args.get("severity")
    since    = (datetime.utcnow() - timedelta(days=days)).isoformat()

    conn = get_db()
    query  = "SELECT * FROM alerts WHERE created_at >= ?"
    params = [since]
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    query += " ORDER BY created_at DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    data = [dict(r) for r in rows]

    if fmt == "csv":
        if not data:
            return Response("No data", mimetype="text/csv")
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename=cyberx_alerts_{days}d.csv"},
        )

    return jsonify({
        "export_metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "period_days":  days,
            "total_rows":   len(data),
        },
        "alerts": data,
    })


# ── Storage stats (admin) ─────────────────────────────────────────────────────

@report_bp.route("/api/admin/storage", methods=["GET"])
def storage_stats():
    """Return live DB storage stats for the dashboard Overview card."""
    from services.retention import get_storage_stats
    return jsonify(get_storage_stats())
