"""
routes/endpoints.py
Endpoint health monitoring for CyberX SIEM.

GET /api/endpoints           — list all known endpoints with live status
GET /api/endpoints/stats     — summary counts (online/stale/offline)
GET /api/endpoints/<hostname> — detail + recent logs for one endpoint
"""

from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from database import get_db
from config import Config

endpoints_bp = Blueprint("endpoints", __name__)


def _compute_status(last_seen_str: str | None) -> str:
    """Return 'online', 'stale', or 'offline' based on last_seen timestamp."""
    if not last_seen_str:
        return "offline"
    try:
        last_seen = datetime.fromisoformat(last_seen_str)
    except ValueError:
        return "offline"
    delta = (datetime.utcnow() - last_seen).total_seconds() / 60
    if delta <= Config.ENDPOINT_ONLINE_MINUTES:
        return "online"
    if delta <= Config.ENDPOINT_STALE_MINUTES:
        return "stale"
    return "offline"


@endpoints_bp.route("/api/endpoints", methods=["GET"])
def list_endpoints():
    """Return all endpoints with computed status."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM endpoints ORDER BY last_seen DESC"
    ).fetchall()
    conn.close()

    result = []
    for r in rows:
        ep = dict(r)
        ep["status"] = _compute_status(ep.get("last_seen"))
        result.append(ep)
    return jsonify(result)


@endpoints_bp.route("/api/endpoints/stats", methods=["GET"])
def endpoint_stats():
    """Return counts per status."""
    conn = get_db()
    rows = conn.execute("SELECT last_seen FROM endpoints").fetchall()
    conn.close()

    counts = {"online": 0, "stale": 0, "offline": 0, "total": len(rows)}
    for r in rows:
        counts[_compute_status(r["last_seen"])] += 1
    return jsonify(counts)


@endpoints_bp.route("/api/endpoints/<hostname>", methods=["GET"])
def endpoint_detail(hostname):
    """Return endpoint info + last 50 logs from that host."""
    limit = int(request.args.get("limit", 50))
    conn = get_db()

    ep = conn.execute(
        "SELECT * FROM endpoints WHERE hostname = ?", (hostname,)
    ).fetchone()
    if not ep:
        conn.close()
        return jsonify({"error": "Endpoint not found"}), 404

    ep_dict = dict(ep)
    ep_dict["status"] = _compute_status(ep_dict.get("last_seen"))

    logs = conn.execute(
        "SELECT * FROM raw_logs WHERE hostname = ? ORDER BY created_at DESC LIMIT ?",
        (hostname, limit),
    ).fetchall()

    alerts = conn.execute(
        "SELECT * FROM alerts WHERE source_ip = ? ORDER BY created_at DESC LIMIT 20",
        (ep_dict.get("source_ip", ""),),
    ).fetchall()

    conn.close()
    return jsonify({
        "endpoint": ep_dict,
        "recent_logs":   [dict(r) for r in logs],
        "recent_alerts": [dict(r) for r in alerts],
    })
