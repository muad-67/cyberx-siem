"""
services/syslog_receiver.py
Tiny UDP syslog listener (RFC 3164-ish). Point routers, firewalls, NAS boxes or
Linux rsyslog at  udp://<this-host>:5514  and the events flow through the same
pipeline as agent logs (storage, detection, alerts).

Disable with SIEM_SYSLOG_PORT=0.
"""

import re
import socket
import threading

from config import Config

_PRI = re.compile(r"^<(\d{1,3})>")
_RFC3164 = re.compile(
    r"^(?:[A-Z][a-z]{2}\s+\d+\s+[\d:]{8}|\d{4}-\d\d-\d\dT[\d:.]+\S*)\s+(?P<host>\S+)\s+"
    r"(?P<app>[\w./-]+?)(?:\[\d+\])?:\s*(?P<msg>.*)$", re.S)

_AUTH_APPS = {"sshd", "sudo", "su", "login", "passwd", "useradd", "usermod", "adduser",
              "pam_unix", "gdm", "polkitd", "authd", "doas"}
_SEVERITY = {0: "critical", 1: "critical", 2: "critical", 3: "high",
             4: "medium", 5: "info", 6: "info", 7: "info"}


def parse_syslog(raw: str, sender_ip: str) -> dict | None:
    """Turn one syslog datagram into the SIEM log dict, or None if it's empty."""
    raw = raw.strip("\x00\r\n ")
    if not raw:
        return None
    severity = "info"
    m = _PRI.match(raw)
    if m:
        severity = _SEVERITY.get(int(m.group(1)) & 7, "info")
        raw = raw[m.end():]

    host, app, msg = sender_ip, "syslog", raw
    p = _RFC3164.match(raw)
    if p:
        host, app, msg = p.group("host"), p.group("app"), p.group("msg")
    app_l = app.lower()
    log_type = ("auth" if app_l in _AUTH_APPS
                else "kernel" if app_l in ("kernel", "kern")
                else "syslog")
    return {
        "source_ip": sender_ip, "hostname": host, "log_type": log_type,
        "severity": severity, "message": f"{app}: {msg}".strip()[:4096],
        "os_type": "syslog",
    }


def _serve(sock):
    from routes.logs import store_and_detect, _valid_ip
    while True:
        try:
            data, (ip, _) = sock.recvfrom(8192)
            event = parse_syslog(data.decode("utf-8", "replace"), ip)
            if event and _valid_ip(ip):
                store_and_detect(event)
        except Exception as e:
            print(f"[SYSLOG] error: {e}")


def start_syslog_receiver():
    if Config.SYSLOG_PORT <= 0:
        return None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(("0.0.0.0", Config.SYSLOG_PORT))
    except OSError as e:
        print(f"[SYSLOG] not started (port {Config.SYSLOG_PORT}): {e}")
        return None
    t = threading.Thread(target=_serve, args=(sock,), daemon=True)
    t.start()
    print(f"[SYSLOG] Listening on udp/{Config.SYSLOG_PORT}")
    return t
