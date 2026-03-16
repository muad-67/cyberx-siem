"""
routes/mitre_route.py
MITRE ATT&CK data endpoints.

GET /api/mitre/summary    — techniques observed in alerts
GET /api/mitre/techniques — full list of mapped techniques
"""

from flask import Blueprint, jsonify
from database import get_db

mitre_bp = Blueprint("mitre", __name__)


@mitre_bp.route("/api/mitre/summary", methods=["GET"])
def summary():
    """Return count of alerts per MITRE technique — used for the heatmap."""
    conn = get_db()
    rows = conn.execute("""
        SELECT
            mitre_tactic,
            mitre_technique,
            mitre_name,
            COUNT(*) AS alert_count,
            CASE MAX(
                CASE severity
                    WHEN 'critical' THEN 4
                    WHEN 'high'     THEN 3
                    WHEN 'medium'   THEN 2
                    WHEN 'low'      THEN 1
                    ELSE 0
                END
            )
            WHEN 4 THEN 'critical'
            WHEN 3 THEN 'high'
            WHEN 2 THEN 'medium'
            WHEN 1 THEN 'low'
            ELSE 'info'
            END AS max_severity
        FROM alerts
        WHERE mitre_technique IS NOT NULL
        GROUP BY mitre_technique
        ORDER BY alert_count DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@mitre_bp.route("/api/mitre/techniques", methods=["GET"])
def techniques():
    """Return all MITRE techniques covered by our rule set."""
    from engine.mitre import MITRE_MAPPINGS
    return jsonify([
        {"alert_type": k, **v}
        for k, v in MITRE_MAPPINGS.items()
        if k != "default"
    ])
