"""
routes/rules.py
Detection-rule management (view, tune, enable/disable, dry-run).

GET  /api/rules                 — all rules with their effective settings + 24h hit counts
PUT  /api/rules/<id>            — admin: set enabled / threshold / window
POST /api/rules/<id>/test       — dry-run a rule against recent logs
"""

from flask import Blueprint, jsonify, request
from database import get_db
from engine.rules import RULES
from engine.detection import _keywords_match
from middleware.auth import require_admin

rules_bp = Blueprint("rules", __name__)


def _rule(rule_id):
    return next((r for r in RULES if r["id"] == rule_id), None)


@rules_bp.route("/api/rules", methods=["GET"])
def list_rules():
    conn = get_db()
    overrides = {r["rule_id"]: r for r in conn.execute("SELECT * FROM rule_overrides").fetchall()}
    hits = {r["alert_type"]: r["n"] for r in conn.execute(
        "SELECT alert_type, COUNT(*) AS n FROM alerts "
        "WHERE created_at >= datetime('now', '-24 hours') GROUP BY alert_type").fetchall()}
    conn.close()

    out = []
    for r in RULES:
        o = overrides.get(r["id"])
        out.append({
            "id": r["id"], "name": r["name"], "log_type": r["log_type"],
            "alert_type": r["alert_type"], "severity": r["severity"],
            "keywords": r["keywords"],
            "default_threshold": r["threshold"], "default_window": r["window"],
            "threshold": (o["threshold"] if o and o["threshold"] else r["threshold"]),
            "window":    (o["window"]    if o and o["window"]    else r["window"]),
            "enabled":   bool(o["enabled"]) if o else True,
            "hits_24h":  hits.get(r["alert_type"], 0),
        })
    return jsonify(out)


@rules_bp.route("/api/rules/<rule_id>", methods=["PUT"])
@require_admin
def update_rule(rule_id):
    if not _rule(rule_id):
        return jsonify({"error": "Unknown rule"}), 404
    data = request.get_json(silent=True) or {}

    def positive(key, hi):
        v = data.get(key)
        if v is None:
            return None
        try:
            v = int(v)
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be a whole number")
        if not 1 <= v <= hi:
            raise ValueError(f"{key} must be between 1 and {hi}")
        return v

    try:
        threshold = positive("threshold", 10000)
        window = positive("window", 86400)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    enabled = 1 if data.get("enabled", True) else 0

    conn = get_db()
    conn.execute("""
        INSERT INTO rule_overrides (rule_id, enabled, threshold, window, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(rule_id) DO UPDATE SET
            enabled = excluded.enabled, threshold = excluded.threshold,
            window = excluded.window, updated_at = CURRENT_TIMESTAMP
    """, (rule_id, enabled, threshold, window))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Rule {rule_id} updated"})


@rules_bp.route("/api/rules/<rule_id>/test", methods=["POST"])
def test_rule(rule_id):
    """How often would this rule have matched in the last N hours (default 24)?"""
    rule = _rule(rule_id)
    if not rule:
        return jsonify({"error": "Unknown rule"}), 404
    data = request.get_json(silent=True) or {}
    hours = max(1, min(int(data.get("hours", 24)), 720))
    threshold = int(data.get("threshold") or rule["threshold"])

    conn = get_db()
    rows = conn.execute("""
        SELECT source_ip, message FROM raw_logs
        WHERE log_type = ? AND created_at >= datetime('now', ? || ' hours')
    """, (rule["log_type"], f"-{hours}")).fetchall()
    conn.close()

    per_ip = {}
    for r in rows:
        if _keywords_match(r["message"], rule["keywords"]):
            per_ip[r["source_ip"]] = per_ip.get(r["source_ip"], 0) + 1
    firing = {ip: n for ip, n in per_ip.items() if n >= threshold}
    return jsonify({
        "rule": rule_id, "hours": hours, "threshold": threshold,
        "matching_events": sum(per_ip.values()),
        "sources_matching": len(per_ip),
        "sources_that_would_alert": len(firing),
        "top_sources": sorted(firing.items(), key=lambda kv: -kv[1])[:5],
    })
