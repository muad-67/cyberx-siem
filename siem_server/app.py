"""
app.py
CyberX SIEM — Flask application entry point.

Registers all blueprints, enables CORS for the React dashboard,
and initializes the database on startup.
"""

import os

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from database import init_db, seed_default_users
from routes.logs        import logs_bp
from routes.alerts      import alerts_bp
from routes.stats       import stats_bp
from routes.response    import response_bp
from routes.mitre_route import mitre_bp
from routes.report      import report_bp
from routes.stream      import stream_bp
from routes.auth        import auth_bp
from routes.endpoints   import endpoints_bp
from routes.rules       import rules_bp
from routes.search      import search_bp
from routes.docs        import docs_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow the React dashboard (any origin in dev) to call the API
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    for bp in (logs_bp, alerts_bp, stats_bp, response_bp, mitre_bp, report_bp, stream_bp, auth_bp, endpoints_bp, rules_bp, search_bp, docs_bp):
        app.register_blueprint(bp)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "CyberX SIEM"})

    return app


def _port_free(port: int) -> bool:
    import socket
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def _pick_port() -> None:
    """If the default port is taken (macOS AirPlay uses 5000), move to the next free one."""
    if "SIEM_PORT" in os.environ or _port_free(Config.PORT):
        return
    for candidate in range(Config.PORT + 1, Config.PORT + 11):
        if _port_free(candidate):
            print(f"[PORT] {Config.PORT} is in use (macOS AirPlay?). Using {candidate} instead.")
            print(f"[PORT] Dashboard: start it with REACT_APP_SIEM_URL=http://127.0.0.1:{candidate} npm start")
            Config.PORT = candidate
            return


if __name__ == "__main__":
    _pick_port()
    is_reloader_child = os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    should_bootstrap = (not Config.DEBUG) or is_reloader_child

    if should_bootstrap:
        init_db()
        seed_default_users()

        from services.retention import start_retention_worker
        start_retention_worker()

        from services.syslog_receiver import start_syslog_receiver
        start_syslog_receiver()

    app = create_app()

    print("=" * 54)
    print("  CyberX Lightweight SIEM — SOC Server")
    print("=" * 54)
    print("  POST  /api/auth/register         create account")
    print("  POST  /api/auth/login            get JWT token")
    print("  GET   /api/auth/me               current user")
    print("  POST  /api/logs                  ingest log")
    print("  GET   /api/logs                  query logs")
    print("  GET   /api/alerts                list alerts")
    print("  PUT   /api/alerts/<id>/status    triage alert")
    print("  GET   /api/stats/overview        dashboard counters")
    print("  GET   /api/stats/top-ips         top attackers")
    print("  POST  /api/response/block-ip     block IP")
    print("  POST  /api/response/watchlist    add to watchlist")
    print("  POST  /api/response/whitelist    add to whitelist")
    print("  GET   /api/mitre/summary         ATT&CK heatmap")
    print("  GET   /api/report/incident/<id>  incident report")
    print("  GET   /api/reports/daily         daily summary")
    print("  GET   /api/stream                SSE real-time feed")
    print("  GET   /api/docs                  interactive API docs")
    print("=" * 54)
    print(f"  Listening on http://0.0.0.0:{Config.PORT}")
    print("=" * 54)

    # threaded=True is required for SSE — each client gets its own thread
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG, threaded=True)
