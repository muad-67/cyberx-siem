"""
routes/logs.py
Log ingestion and retrieval endpoints.

POST /api/logs        — receive a single log from an agent
GET  /api/logs        — query stored logs (filterable + full-text search)
GET  /api/logs/count  — total log count for dashboard
GET  /api/logs/search — advanced structured search
"""

import json
import re
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

logs_bp = Blueprint("logs", __name__)

_IP_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")


def _valid_ip(ip: str) -> bool:
    if not ip or not _IP_RE.match(ip):
        return False
    return all(0 <= int(o) <= 255 for o in ip.split("."))


@logs_bp.route("/api/logs", methods=["POST"])
def ingest_log():
    """
    Receive a JSON log entry from an endpoint agent.

    Required fields: source_ip, log_type, message
    Optional fields: timestamp, hostname, severity, raw_data
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    for field in ("source_ip", "log_type", "message"):
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    if not _valid_ip(data["source_ip"]):
        return jsonify({"error": "Invalid source_ip"}), 400

    # Truncate overly long messages to prevent DB bloat
    message = str(data["message"])[:4096]

    # Geo-enrich the source IP (non-blocking, cached)
    from services.geo import lookup as geo_lookup
    geo = geo_lookup(data["source_ip"])

    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO raw_logs
            (timestamp, source_ip, hostname, log_type, severity, message, raw_data,
             country, city, isp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.utcnow().isoformat()),
        data["source_ip"],
        data.get("hostname", "unknown"),
        data["log_type"],
        data.get("severity", "info"),
        message,
        json.dumps(data),
        geo.get("country"),
        geo.get("city"),
        geo.get("isp"),
    ))
    log_id = c.lastrowid
    conn.commit()
    conn.close()

    # Upsert endpoint health record
    _upsert_endpoint(data)

    # Run detection engine — import here to avoid circular imports at module load
    from engine.detection import run_detection_on_log
    alerts = run_detection_on_log(data, log_id)

    return jsonify({
        "status":           "received",
        "log_id":           log_id,
        "alerts_generated": len(alerts),
        "alerts":           alerts,
    }), 201


def _upsert_endpoint(data: dict):
    """Update or insert an endpoint record on every log received."""
    hostname  = data.get("hostname", "unknown")
    source_ip = data.get("source_ip", "")
    os_type   = data.get("os_type", "unknown")
    agent_ver = data.get("agent_version", "unknown")
    now       = datetime.utcnow().isoformat()
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM endpoints WHERE hostname = ?", (hostname,)
    ).fetchone()
    if existing:
        conn.execute("""
            UPDATE endpoints
            SET source_ip=?, last_seen=?, log_count=log_count+1, os_type=?
            WHERE hostname=?
        """, (source_ip, now, os_type, hostname))
    else:
        conn.execute("""
            INSERT INTO endpoints (hostname, source_ip, os_type, agent_version, first_seen, last_seen, log_count)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (hostname, source_ip, os_type, agent_ver, now, now))
    conn.commit()
    conn.close()


@logs_bp.route("/api/logs", methods=["GET"])
def get_logs():
    """
    Return logs. Supports:
      ?limit=100  ?offset=0  ?source_ip=x  ?log_type=auth  ?severity=high
      ?q=keyword  ?from=ISO  ?to=ISO  ?hostname=x
    """
    limit     = min(int(request.args.get("limit", 100)), 1000)
    offset    = int(request.args.get("offset", 0))
    source_ip = request.args.get("source_ip")
    log_type  = request.args.get("log_type")
    severity  = request.args.get("severity")
    hostname  = request.args.get("hostname")
    q         = request.args.get("q")           # full-text keyword
    from_dt   = request.args.get("from")        # ISO datetime lower bound
    to_dt     = request.args.get("to")          # ISO datetime upper bound

    query  = "SELECT * FROM raw_logs WHERE 1=1"
    params = []

    if source_ip:
        query += " AND source_ip = ?";  params.append(source_ip)
    if log_type:
        query += " AND log_type = ?";   params.append(log_type)
    if severity:
        query += " AND severity = ?";   params.append(severity)
    if hostname:
        query += " AND hostname = ?";   params.append(hostname)
    if q:
        query += " AND message LIKE ?"; params.append(f"%{q}%")
    if from_dt:
        query += " AND created_at >= ?"; params.append(from_dt)
    if to_dt:
        query += " AND created_at <= ?"; params.append(to_dt)

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    conn = get_db()
    rows = conn.execute(query, params).fetchall()

    # Count total matching results (for pagination UI)
    count_query = query.replace("SELECT *", "SELECT COUNT(*)", 1)
    count_query = count_query[:count_query.rfind("ORDER BY")]
    total = conn.execute(count_query, params[:-2]).fetchone()[0]
    conn.close()

    return jsonify({"total": total, "logs": [dict(r) for r in rows]})


@logs_bp.route("/api/logs/search", methods=["GET"])
def search_logs():
    """
    Structured search endpoint — same params as GET /api/logs but returns
    total count alongside results for the search UI.
    Alias kept for semantic clarity.
    """
    return get_logs()


@logs_bp.route("/api/logs/count", methods=["GET"])
def log_count():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM raw_logs").fetchone()[0]
    conn.close()
    return jsonify({"total": total})
