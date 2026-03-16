"""
config.py
Central configuration for the CyberX SIEM server.
Change values here to tune detection thresholds or network settings.
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    # ── Flask ───────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("SECRET_KEY", "cyberx-siem-secret-2024")
    DEBUG = True

    # ── Server binding ──────────────────────────────────────────────────
    HOST = "0.0.0.0"   # listen on all interfaces so VM agents can reach us
    PORT = 5000

    # ── Database ────────────────────────────────────────────────────────
    DB_PATH = os.path.join(BASE_DIR, "siem.db")

    # ── JWT Authentication ──────────────────────────────────────────────
    JWT_SECRET_KEY             = os.environ.get("JWT_SECRET_KEY", "cyberx-jwt-secret-2024")
    JWT_EXPIRY_HOURS           = 24  # token lifetime in hours

    # ── Detection thresholds ────────────────────────────────────────────
    BRUTE_FORCE_THRESHOLD      = 5   # failed logins before alert fires
    BRUTE_FORCE_WINDOW_SEC     = 60  # sliding window in seconds
    PORT_SCAN_THRESHOLD        = 10  # distinct connection attempts
    PORT_SCAN_WINDOW_SEC       = 30  # sliding window in seconds
    ALERT_DEDUP_MINUTES        = 5   # suppress duplicate alerts within N minutes

    # ── Log retention ───────────────────────────────────────────────────
    LOG_RETENTION_DAYS         = 30  # logs older than this are archived
    ARCHIVE_DB_PATH            = os.path.join(BASE_DIR, "siem_archive.db")

    # ── Correlation ─────────────────────────────────────────────────────
    CORRELATION_WINDOW_MINUTES = 10  # group alerts from same IP within N mins

    # ── Threat Intelligence ──────────────────────────────────────────────
    ABUSEIPDB_KEY              = os.environ.get("ABUSEIPDB_KEY", "")   # free at abuseipdb.com
    TI_CACHE_HOURS             = 24   # re-check IPs after N hours

    # ── Endpoint Health ──────────────────────────────────────────────────
    ENDPOINT_ONLINE_MINUTES    = 5    # last_seen < N min = online
    ENDPOINT_STALE_MINUTES     = 60   # last_seen < N min = stale (else offline)
