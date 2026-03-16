"""
routes/stream.py
Server-Sent Events (SSE) endpoint for real-time dashboard updates.

GET /api/stream  —  persistent HTTP stream that pushes:
  event: log      { new raw_log row }        whenever a new log is ingested
  event: alert    { new alert row }          whenever a new alert fires
  event: stats    { overview counters }      every 4 seconds
  event: heartbeat                           every second (keeps connection alive)

The browser EventSource API reconnects automatically; Last-Event-ID is used
to resume from the correct position without replaying history.
"""

import json
import time
from flask import Blueprint, Response, request, stream_with_context
from database import get_db

stream_bp = Blueprint("stream", __name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fmt(name: str, data: dict, event_id: int = None) -> str:
    """Format a single SSE frame."""
    parts = []
    if event_id is not None:
        parts.append(f"id: {event_id}")
    parts.append(f"event: {name}")
    parts.append(f"data: {json.dumps(data, default=str)}")
    parts.append("")   # blank line = end of frame
    parts.append("")
    return "\n".join(parts)


def _overview() -> dict:
    conn = get_db()
    q = conn.execute
    data = {
        "total_logs":      q("SELECT COUNT(*) FROM raw_logs").fetchone()[0],
        "total_alerts":    q("SELECT COUNT(*) FROM alerts").fetchone()[0],
        "open_alerts":     q("SELECT COUNT(*) FROM alerts WHERE status='open'").fetchone()[0],
        "critical_alerts": q("SELECT COUNT(*) FROM alerts WHERE severity='critical'").fetchone()[0],
        "blocked_ips":     q("SELECT COUNT(*) FROM blocked_ips").fetchone()[0],
    }
    conn.close()
    return data


# ── Generator ─────────────────────────────────────────────────────────────────

def _generate(last_log_id: int, last_alert_id: int):
    """
    Infinite generator: polls SQLite every second and yields SSE frames for
    any new rows found. Sends overview stats every 4 ticks.
    Yields a heartbeat comment every tick to prevent proxy timeouts.
    """
    tick = 0

    while True:
        try:
            conn = get_db()

            # ── new logs ─────────────────────────────────────────────────
            new_logs = conn.execute(
                "SELECT * FROM raw_logs WHERE id > ? ORDER BY id ASC LIMIT 50",
                (last_log_id,)
            ).fetchall()

            for row in new_logs:
                log = dict(row)
                last_log_id = log["id"]
                yield _fmt("log", log, last_log_id)

            # ── new alerts ───────────────────────────────────────────────
            new_alerts = conn.execute(
                "SELECT * FROM alerts WHERE id > ? ORDER BY id ASC LIMIT 20",
                (last_alert_id,)
            ).fetchall()

            for row in new_alerts:
                alert = dict(row)
                last_alert_id = alert["id"]
                yield _fmt("alert", alert, last_alert_id)

            conn.close()

        except Exception:
            pass   # don't crash the stream on a transient DB error

        # ── periodic stats ───────────────────────────────────────────────
        tick += 1
        if tick % 4 == 0:
            try:
                yield _fmt("stats", _overview())
            except Exception:
                pass

        # heartbeat comment — browsers ignore it but it flushes the buffer
        yield f": heartbeat {tick}\n\n"
        time.sleep(1)


# ── Route ─────────────────────────────────────────────────────────────────────

@stream_bp.route("/api/stream")
def stream():
    """
    Opens a Server-Sent Events stream.
    The browser sends Last-Event-ID on reconnect so we resume from the right place.
    """
    # Resume from where this client left off (browser sends Last-Event-ID header)
    resume_id = int(request.headers.get("Last-Event-ID", 0) or 0)

    if resume_id > 0:
        # Client is resuming — use the saved position
        last_log_id   = resume_id
        last_alert_id = 0
    else:
        # Fresh connection — start from the current tail so we only push NEW rows
        conn = get_db()
        last_log_id   = conn.execute("SELECT COALESCE(MAX(id),0) FROM raw_logs").fetchone()[0]
        last_alert_id = conn.execute("SELECT COALESCE(MAX(id),0) FROM alerts").fetchone()[0]
        conn.close()

    return Response(
        stream_with_context(_generate(last_log_id, last_alert_id)),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",    # disable nginx response buffering
            "Connection":       "keep-alive",
        },
    )
