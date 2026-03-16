"""
routes/response.py
Simulated incident response actions.

POST /api/response/block-ip       — record a simulated IP block
GET  /api/response/blocked-ips    — list all blocked IPs
POST /api/response/watchlist      — add IP to watchlist
DELETE /api/response/watchlist/<ip> — remove from watchlist
GET  /api/response/watchlist      — list watchlist
POST /api/response/whitelist      — add IP to whitelist (no alerts)
DELETE /api/response/whitelist/<ip> — remove from whitelist
GET  /api/response/whitelist      — list whitelist
"""

from flask import Blueprint, request, jsonify
from database import get_db

response_bp = Blueprint("response", __name__)


@response_bp.route("/api/response/block-ip", methods=["POST"])
def block_ip():
    """
    Simulate blocking an IP address.
    Stores the action in blocked_ips and marks related alert resolved.
    In a real deployment this would call a firewall API (e.g. pfSense, iptables).
    """
    data = request.get_json(silent=True) or {}
    ip   = data.get("ip_address", "").strip()

    if not ip:
        return jsonify({"error": "ip_address is required"}), 400

    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO blocked_ips (ip_address, reason, blocked_by, alert_id)
            VALUES (?, ?, ?, ?)
        """, (
            ip,
            data.get("reason", "Manual block"),
            data.get("blocked_by", "SOC Analyst"),
            data.get("alert_id"),
        ))

        # Resolve the linked alert if provided
        if data.get("alert_id"):
            conn.execute(
                "UPDATE alerts SET status='resolved' WHERE id=?",
                (data["alert_id"],),
            )

        conn.commit()
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 409   # likely a duplicate

    conn.close()
    return jsonify({
        "status":     "blocked",
        "ip_address": ip,
        "message":    f"{ip} added to block list (simulated).",
    }), 201


@response_bp.route("/api/response/blocked-ips", methods=["GET"])
def blocked_ips():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM blocked_ips ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── Watchlist ─────────────────────────────────────────────────────────────────

@response_bp.route("/api/response/watchlist", methods=["POST"])
def add_to_watchlist():
    """Flag an IP for heightened monitoring (boosts its risk score)."""
    data = request.get_json(silent=True) or {}
    ip   = data.get("ip_address", "").strip()
    if not ip:
        return jsonify({"error": "ip_address is required"}), 400
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO watchlist (ip_address, reason, added_by) VALUES (?, ?, ?)",
            (ip, data.get("reason", "Manual watch"), data.get("added_by", "SOC Analyst")),
        )
        conn.commit()
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 409
    conn.close()
    return jsonify({"status": "watching", "ip_address": ip}), 201


@response_bp.route("/api/response/watchlist", methods=["GET"])
def get_watchlist():
    conn = get_db()
    rows = conn.execute("SELECT * FROM watchlist ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@response_bp.route("/api/response/watchlist/<ip>", methods=["DELETE"])
def remove_from_watchlist(ip):
    conn = get_db()
    conn.execute("DELETE FROM watchlist WHERE ip_address = ?", (ip,))
    conn.commit()
    conn.close()
    return jsonify({"status": "removed", "ip_address": ip})


# ── Whitelist ─────────────────────────────────────────────────────────────────

@response_bp.route("/api/response/whitelist", methods=["POST"])
def add_to_whitelist():
    """Mark an IP as trusted — the detection engine will skip it entirely."""
    data = request.get_json(silent=True) or {}
    ip   = data.get("ip_address", "").strip()
    if not ip:
        return jsonify({"error": "ip_address is required"}), 400
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO whitelist (ip_address, reason, added_by) VALUES (?, ?, ?)",
            (ip, data.get("reason", "Trusted host"), data.get("added_by", "SOC Analyst")),
        )
        conn.commit()
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 409
    conn.close()
    return jsonify({"status": "whitelisted", "ip_address": ip}), 201


@response_bp.route("/api/response/whitelist", methods=["GET"])
def get_whitelist():
    conn = get_db()
    rows = conn.execute("SELECT * FROM whitelist ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@response_bp.route("/api/response/whitelist/<ip>", methods=["DELETE"])
def remove_from_whitelist(ip):
    conn = get_db()
    conn.execute("DELETE FROM whitelist WHERE ip_address = ?", (ip,))
    conn.commit()
    conn.close()
    return jsonify({"status": "removed", "ip_address": ip})


# ── Threat Intelligence ────────────────────────────────────────────────────────

@response_bp.route("/api/threat-intel/<ip>", methods=["GET"])
def check_threat_intel(ip):
    """On-demand IP reputation lookup via AbuseIPDB (cached 24h in DB)."""
    from services.threat_intel import check_ip
    result = check_ip(ip)
    return jsonify(result)


@response_bp.route("/api/threat-intel/cache", methods=["GET"])
def threat_intel_cache():
    """Return all cached TI results."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM threat_intel_cache ORDER BY last_checked DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
