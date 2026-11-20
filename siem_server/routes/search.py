"""
routes/search.py
GET /api/search?q=...  — one box for IPs, hostnames, alerts and MITRE techniques.
"""

from flask import Blueprint, jsonify, request
from database import get_db

search_bp = Blueprint("search", __name__)


@search_bp.route("/api/search", methods=["GET"])
def search():
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"alerts": [], "ips": [], "hosts": []})
    like = f"%{q}%"
    conn = get_db()
    alerts = conn.execute("""
        SELECT id, alert_type, severity, source_ip, mitre_technique, created_at
        FROM alerts
        WHERE CAST(id AS TEXT) = ? OR alert_type LIKE ? OR source_ip LIKE ?
              OR mitre_technique LIKE ? OR mitre_name LIKE ? OR description LIKE ?
        ORDER BY created_at DESC LIMIT 6
    """, (q.lstrip("#"), like, like, like, like, like)).fetchall()
    ips = conn.execute("""
        SELECT source_ip, COUNT(*) AS events FROM raw_logs
        WHERE source_ip LIKE ? GROUP BY source_ip ORDER BY events DESC LIMIT 5
    """, (like,)).fetchall()
    hosts = conn.execute("""
        SELECT hostname, source_ip FROM endpoints
        WHERE hostname LIKE ? ORDER BY last_seen DESC LIMIT 5
    """, (like,)).fetchall()
    conn.close()
    return jsonify({"alerts": [dict(r) for r in alerts],
                    "ips": [dict(r) for r in ips],
                    "hosts": [dict(r) for r in hosts]})
