"""
routes/alerts.py
Alert and incident management endpoints.

GET  /api/alerts               — list alerts
PUT  /api/alerts/<id>/status   — update alert status
GET  /api/alerts/count         — counts by severity
POST /api/incidents            — create incident from alerts
GET  /api/incidents            — list incidents
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db

alerts_bp = Blueprint("alerts", __name__)

_VALID_STATUSES = {"open", "investigating", "resolved", "false_positive"}


@alerts_bp.route("/api/alerts", methods=["GET"])
def get_alerts():
    limit    = min(int(request.args.get("limit", 50)), 500)
    status   = request.args.get("status")
    severity = request.args.get("severity")

    query  = "SELECT * FROM alerts WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?";   params.append(status)
    if severity:
        query += " AND severity = ?"; params.append(severity)
    query += " ORDER BY risk_score DESC, created_at DESC LIMIT ?"
    params.append(limit)

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@alerts_bp.route("/api/alerts/<int:alert_id>/status", methods=["PUT"])
def update_status(alert_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in _VALID_STATUSES:
        return jsonify({"error": f"status must be one of {sorted(_VALID_STATUSES)}"}), 400

    conn = get_db()
    conn.execute("UPDATE alerts SET status = ? WHERE id = ?", (status, alert_id))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Alert {alert_id} → {status}"})


@alerts_bp.route("/api/alerts/count", methods=["GET"])
def alert_count():
    conn = get_db()
    rows = conn.execute(
        "SELECT severity, COUNT(*) AS count FROM alerts GROUP BY severity"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── Incidents ─────────────────────────────────────────────────────────────────

@alerts_bp.route("/api/incidents", methods=["POST"])
def create_incident():
    data = request.get_json(silent=True) or {}
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO incidents (title, description, severity, alert_ids)
        VALUES (?, ?, ?, ?)
    """, (
        data.get("title", "Unnamed Incident"),
        data.get("description", ""),
        data.get("severity", "medium"),
        ",".join(str(i) for i in data.get("alert_ids", [])),
    ))
    incident_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"incident_id": incident_id, "status": "created"}), 201


@alerts_bp.route("/api/incidents", methods=["GET"])
def get_incidents():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM incidents ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@alerts_bp.route("/api/incidents/<int:incident_id>", methods=["GET"])
def get_incident_detail(incident_id):
    """Return a single incident with its notes and linked alerts."""
    conn = get_db()
    inc = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    if not inc:
        conn.close()
        return jsonify({"error": "Incident not found"}), 404

    notes = conn.execute(
        "SELECT * FROM investigation_notes WHERE incident_id = ? ORDER BY created_at ASC",
        (incident_id,)
    ).fetchall()

    inc_dict = dict(inc)
    alert_ids = [int(x) for x in inc_dict.get("alert_ids", "").split(",") if x.strip().isdigit()]
    linked_alerts = []
    if alert_ids:
        placeholders = ",".join("?" * len(alert_ids))
        linked_alerts = conn.execute(
            f"SELECT * FROM alerts WHERE id IN ({placeholders})", alert_ids
        ).fetchall()

    conn.close()
    return jsonify({
        "incident": inc_dict,
        "notes":    [dict(n) for n in notes],
        "alerts":   [dict(a) for a in linked_alerts],
    })


@alerts_bp.route("/api/incidents/<int:incident_id>", methods=["PUT"])
def update_incident(incident_id):
    """Update tags, assigned_to, priority, status, description."""
    data = request.get_json(silent=True) or {}
    fields, params = [], []

    for col in ("title", "description", "severity", "status", "assigned_to", "tags", "priority"):
        if col in data:
            fields.append(f"{col} = ?")
            params.append(data[col])

    if not fields:
        return jsonify({"error": "No fields to update"}), 400

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(incident_id)

    conn = get_db()
    conn.execute(f"UPDATE incidents SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return jsonify({"status": "updated", "incident_id": incident_id})


@alerts_bp.route("/api/incidents/<int:incident_id>/notes", methods=["POST"])
def add_note(incident_id):
    """Append an investigation note to an incident."""
    data    = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400

    conn = get_db()
    # Verify incident exists
    if not conn.execute("SELECT id FROM incidents WHERE id = ?", (incident_id,)).fetchone():
        conn.close()
        return jsonify({"error": "Incident not found"}), 404

    c = conn.cursor()
    c.execute("""
        INSERT INTO investigation_notes (incident_id, author, content, note_type)
        VALUES (?, ?, ?, ?)
    """, (
        incident_id,
        data.get("author", "SOC Analyst"),
        content,
        data.get("note_type", "note"),
    ))
    note_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"note_id": note_id, "status": "created"}), 201


@alerts_bp.route("/api/incidents/<int:incident_id>/notes", methods=["GET"])
def get_notes(incident_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM investigation_notes WHERE incident_id = ? ORDER BY created_at ASC",
        (incident_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
