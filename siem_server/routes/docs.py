"""
routes/docs.py
Interactive API documentation.

GET /api/docs          — Swagger UI (try every endpoint in the browser)
GET /api/openapi.json  — the OpenAPI 3 spec behind it
"""

from flask import Blueprint, jsonify, Response

docs_bp = Blueprint("docs", __name__)

# (method, path, tag, summary, auth, query params, body example, notes)
#   auth: "none" | "user" | "admin"
#   query: {name: (example, description)}
E = []
def ep(method, path, tag, summary, auth="none", query=None, body=None, notes=""):
    E.append((method, path, tag, summary, auth, query or {}, body, notes))

# ── Auth ──
ep("post", "/api/auth/login", "Auth", "Log in and get a JWT", body={"username": "mohadek", "password": "…"},
   notes="Copy `token` from the response, press **Authorize** (top right) and paste it.")
ep("post", "/api/auth/register", "Auth", "Create an account", body={"username": "analyst2", "email": "analyst2@cyberx.local", "password": "ChangeMe123!", "role": "analyst"})
ep("get",  "/api/auth/me", "Auth", "Current user", "user")
ep("post", "/api/auth/logout", "Auth", "Log out", "user")
ep("get",  "/api/auth/users", "Auth", "List users", "admin")

# ── Logs ──
ep("post", "/api/logs", "Logs", "Ingest one log (used by agents)",
   body={"source_ip": "10.10.10.99", "log_type": "auth", "hostname": "test-vm", "message": "Failed password for root from 10.10.10.99 port 22 ssh2"},
   notes="Send 5+ failed logins within 60s to trigger a `brute_force` alert. `log_type`: auth, syslog, network, kernel, windows, web, system.")
ep("get", "/api/logs", "Logs", "List logs", query={"limit": (100, "max 1000"), "offset": (0, ""), "log_type": ("auth", ""), "severity": ("high", ""),
   "source_ip": ("10.10.10.99", ""), "hostname": ("test-vm", ""), "q": ("Failed password", "keyword"), "from": ("2026-01-01 00:00:00", "UTC"), "to": ("2026-12-31 23:59:59", "UTC")})
ep("get", "/api/logs/search", "Logs", "Search logs", query={"q": ("Failed password", "keyword"), "limit": (50, "")})
ep("get", "/api/logs/count", "Logs", "Total log count")

# ── Alerts ──
ep("get", "/api/alerts", "Alerts", "List alerts", query={"limit": (50, "max 500"), "status": ("open", "open | investigating | resolved | false_positive"), "severity": ("critical", "")})
ep("get", "/api/alerts/count", "Alerts", "Alert counts by severity")
ep("put", "/api/alerts/{alert_id}/status", "Alerts", "Change an alert's status", body={"status": "investigating"})
ep("get", "/api/report/incident/{alert_id}", "Alerts", "Incident report for an alert")

# ── Incidents ──
ep("get",  "/api/incidents", "Incidents", "List incidents")
ep("post", "/api/incidents", "Incidents", "Create an incident", body={"title": "Suspicious activity", "description": "…", "severity": "high", "alert_ids": [1, 2]})
ep("get",  "/api/incidents/{incident_id}", "Incidents", "Incident with its alerts")
ep("put",  "/api/incidents/{incident_id}", "Incidents", "Update an incident", body={"status": "investigating", "priority": "high", "assigned_to": "mohadek", "tags": "ssh"})
ep("get",  "/api/incidents/{incident_id}/notes", "Incidents", "List notes")
ep("post", "/api/incidents/{incident_id}/notes", "Incidents", "Add a note", body={"content": "Checked auth logs.", "author": "mohadek", "note_type": "note"})

# ── Detection rules ──
ep("get",  "/api/rules", "Detection rules", "List rules with settings and 24h hit counts")
ep("put",  "/api/rules/{rule_id}", "Detection rules", "Enable/disable or tune a rule", "admin", body={"enabled": True, "threshold": 5, "window": 60})
ep("post", "/api/rules/{rule_id}/test", "Detection rules", "Dry-run a rule against recent logs", body={"hours": 24, "threshold": 5})

# ── Response ──
ep("post",   "/api/response/block-ip", "Response", "Block an IP (simulated)", body={"ip_address": "203.0.113.50", "reason": "Brute force", "alert_id": 1})
ep("get",    "/api/response/blocked-ips", "Response", "List blocked IPs")
ep("post",   "/api/response/watchlist", "Response", "Add an IP to the watchlist", body={"ip_address": "203.0.113.51", "reason": "Scanner"})
ep("get",    "/api/response/watchlist", "Response", "List the watchlist")
ep("delete", "/api/response/watchlist/{ip}", "Response", "Remove from the watchlist")
ep("post",   "/api/response/whitelist", "Response", "Add a trusted IP", body={"ip_address": "192.168.1.10", "reason": "Office scanner"})
ep("get",    "/api/response/whitelist", "Response", "List trusted IPs")
ep("delete", "/api/response/whitelist/{ip}", "Response", "Remove a trusted IP")
ep("get",    "/api/threat-intel/{ip}", "Response", "Reputation lookup (needs ABUSEIPDB_KEY)")
ep("get",    "/api/threat-intel/cache", "Response", "Cached reputation results")

# ── Stats & search ──
ep("get", "/api/stats/overview", "Stats and search", "Headline counters")
ep("get", "/api/stats/top-ips", "Stats and search", "Top attacking IPs")
ep("get", "/api/stats/alerts-by-type", "Stats and search", "Alerts per attack type")
ep("get", "/api/stats/top-countries", "Stats and search", "Top attacking countries")
ep("get", "/api/stats/hourly-logs", "Stats and search", "Log volume over time", query={"hours": (24, "1-720. Up to 72h per hour, longer per day (UTC)")})
ep("get", "/api/timeline/{source_ip}", "Stats and search", "Everything one IP did", query={"hours": (24, "")})
ep("get", "/api/search", "Stats and search", "Search IPs, hosts and alerts", query={"q": ("10.10", "2+ characters")})

# ── MITRE / endpoints / reports / stream ──
ep("get", "/api/mitre/summary", "MITRE ATT&CK", "Technique coverage")
ep("get", "/api/mitre/techniques", "MITRE ATT&CK", "All known techniques")
ep("get", "/api/endpoints", "Endpoints", "Endpoints with health status")
ep("get", "/api/endpoints/stats", "Endpoints", "Online / stale / offline counts")
ep("get", "/api/endpoints/{hostname}", "Endpoints", "One endpoint with recent logs")
ep("get", "/api/reports/daily", "Reports", "Daily summary", query={"days": (1, "")})
ep("get", "/api/reports/weekly", "Reports", "Weekly summary")
ep("get", "/api/reports/export", "Reports", "Export alerts as JSON or CSV", query={"format": ("json", "json | csv"), "days": (7, ""), "severity": ("critical", "")})
ep("get", "/api/admin/storage", "Reports", "Database size and retention")
ep("get", "/api/stream", "Live stream", "Server-Sent Events: log, alert, stats", notes="Swagger UI can't display a stream. Use `curl -N` or the dashboard.")
ep("get", "/api/health", "Health", "Is the server up?")


def _spec() -> dict:
    import re
    paths = {}
    for method, path, tag, summary, auth, query, body, notes in E:
        op = {"tags": [tag], "summary": summary, "responses": {"200": {"description": "OK"}}}
        if notes:
            op["description"] = notes
        params = [{"name": n, "in": "path", "required": True, "schema": {"type": "string"}}
                  for n in re.findall(r"\{(\w+)\}", path)]
        for name, (example, desc) in query.items():
            params.append({"name": name, "in": "query", "description": desc,
                           "schema": {"type": "string" if isinstance(example, str) else "integer"}, "example": example})
        if params:
            op["parameters"] = params
        if body is not None:
            op["requestBody"] = {"required": True, "content": {"application/json": {"schema": {"type": "object"}, "example": body}}}
        if auth != "none":
            op["security"] = [{"bearerAuth": []}]
            op["description"] = (op.get("description", "") + f"\n\nRequires {'an admin' if auth == 'admin' else 'a signed-in'} user.").strip()
        paths.setdefault(path, {})[method] = op
    return {
        "openapi": "3.0.3",
        "info": {"title": "CyberX SIEM API", "version": "1.0",
                 "description": "Log ingestion, detection, alerts, incidents, response and reporting.\n\n"
                                "**Start here:** call `POST /api/auth/login`, copy the `token`, click **Authorize** and paste it."},
        "servers": [{"url": "/"}],
        "components": {"securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}}},
        "paths": paths,
    }


@docs_bp.route("/api/openapi.json")
def openapi():
    return jsonify(_spec())


@docs_bp.route("/api/docs")
def docs():
    html = """<!doctype html><html><head><meta charset="utf-8"><title>CyberX API docs</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url: "/api/openapi.json", dom_id: "#ui", deepLinking: true, persistAuthorization: true, tryItOutEnabled: true});</script>
</body></html>"""
    return Response(html, mimetype="text/html")
