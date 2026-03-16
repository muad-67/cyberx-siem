"""
routes/stats.py
Aggregated statistics for the SOC dashboard.

GET /api/stats/overview       — headline counters
GET /api/stats/top-ips        — top attacking source IPs
GET /api/stats/alerts-by-type — alert counts per attack type
GET /api/stats/hourly-logs    — log volume over last 24 hours
"""

from flask import Blueprint, jsonify, request
from database import get_db

stats_bp = Blueprint("stats", __name__)


@stats_bp.route("/api/stats/overview", methods=["GET"])
def overview():
    conn = get_db()
    q = conn.execute
    data = {
        "total_logs":      q("SELECT COUNT(*) FROM raw_logs").fetchone()[0],
        "total_alerts":    q("SELECT COUNT(*) FROM alerts").fetchone()[0],
        "open_alerts":     q("SELECT COUNT(*) FROM alerts WHERE status='open'").fetchone()[0],
        "critical_alerts": q("SELECT COUNT(*) FROM alerts WHERE severity='critical'").fetchone()[0],
        "blocked_ips":     q("SELECT COUNT(*) FROM blocked_ips").fetchone()[0],
        "watchlist_count": q("SELECT COUNT(*) FROM watchlist").fetchone()[0],
        "whitelist_count": q("SELECT COUNT(*) FROM whitelist").fetchone()[0],
    }
    conn.close()
    return jsonify(data)


@stats_bp.route("/api/stats/top-ips", methods=["GET"])
def top_ips():
    conn = get_db()
    rows = conn.execute("""
        SELECT source_ip, COUNT(*) AS alert_count
        FROM alerts
        WHERE source_ip IS NOT NULL
        GROUP BY source_ip
        ORDER BY alert_count DESC
        LIMIT 10
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@stats_bp.route("/api/stats/alerts-by-type", methods=["GET"])
def alerts_by_type():
    conn = get_db()
    rows = conn.execute("""
        SELECT alert_type, COUNT(*) AS count
        FROM alerts
        GROUP BY alert_type
        ORDER BY count DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@stats_bp.route("/api/stats/top-countries", methods=["GET"])
def top_countries():
    """Return the top attacking countries based on geo-enriched log data."""
    conn = get_db()
    rows = conn.execute("""
        SELECT country, COUNT(*) AS count
        FROM raw_logs
        WHERE country IS NOT NULL AND country != 'Unknown' AND country != 'Private'
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@stats_bp.route("/api/stats/hourly-logs", methods=["GET"])
def hourly_logs():
    conn = get_db()
    rows = conn.execute("""
        SELECT strftime('%Y-%m-%d %H:00', created_at) AS hour,
               COUNT(*) AS count
        FROM raw_logs
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY hour
        ORDER BY hour ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@stats_bp.route("/api/timeline/<source_ip>", methods=["GET"])
def timeline(source_ip):
    """
    Return a chronological attack timeline for a given IP.
    Merges raw_logs and alerts sorted by timestamp.
    ?hours=24  controls the lookback window (default 24).
    """
    hours = int(request.args.get("hours", 24))
    conn  = get_db()

    logs = conn.execute("""
        SELECT id, timestamp, 'log' AS event_type, log_type, severity,
               message, hostname, country, NULL AS mitre_technique,
               NULL AS mitre_tactic, NULL AS alert_type, NULL AS risk_score
        FROM raw_logs
        WHERE source_ip = ?
          AND created_at >= datetime('now', ? || ' hours')
        ORDER BY timestamp ASC
    """, (source_ip, f"-{hours}")).fetchall()

    alerts = conn.execute("""
        SELECT id, timestamp, 'alert' AS event_type, alert_type AS log_type, severity,
               description AS message, NULL AS hostname, NULL AS country,
               mitre_technique, mitre_tactic, alert_type, risk_score
        FROM alerts
        WHERE source_ip = ?
          AND created_at >= datetime('now', ? || ' hours')
        ORDER BY timestamp ASC
    """, (source_ip, f"-{hours}")).fetchall()

    conn.close()

    events = [dict(r) for r in logs] + [dict(r) for r in alerts]
    events.sort(key=lambda e: e.get("timestamp") or "")

    return jsonify({"source_ip": source_ip, "hours": hours, "events": events})
