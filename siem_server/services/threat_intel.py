"""
services/threat_intel.py
IP reputation checks via AbuseIPDB (free tier: 1,000 checks/day).

Usage:
  Set ABUSEIPDB_KEY environment variable before starting the server.
  Results are cached in the threat_intel_cache DB table for TI_CACHE_HOURS.
  If no key is configured, returns {"source": "not_configured"} gracefully.

API docs: https://docs.abuseipdb.com/#check-endpoint
"""

from __future__ import annotations
from datetime import datetime, timedelta
import requests
from database import get_db
from config import Config

_PRIVATE_PREFIXES = ("10.", "172.16.", "172.17.", "172.18.", "172.19.",
                     "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                     "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                     "172.30.", "172.31.", "192.168.", "127.", "::1")


def _is_private(ip: str) -> bool:
    return any(ip.startswith(p) for p in _PRIVATE_PREFIXES)


def _from_cache(ip: str) -> dict | None:
    """Return cached TI result if still fresh, else None."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM threat_intel_cache WHERE ip_address = ?", (ip,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    last = datetime.fromisoformat(row["last_checked"])
    if (datetime.utcnow() - last).total_seconds() / 3600 < Config.TI_CACHE_HOURS:
        return dict(row)
    return None  # cache expired


def _save_to_cache(ip: str, data: dict):
    """Upsert TI result into the cache table."""
    conn = get_db()
    conn.execute("""
        INSERT INTO threat_intel_cache
            (ip_address, abuse_score, is_malicious, isp, usage_type,
             total_reports, country_code, last_checked, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ip_address) DO UPDATE SET
            abuse_score=excluded.abuse_score,
            is_malicious=excluded.is_malicious,
            isp=excluded.isp,
            usage_type=excluded.usage_type,
            total_reports=excluded.total_reports,
            country_code=excluded.country_code,
            last_checked=excluded.last_checked,
            source=excluded.source
    """, (
        ip,
        data.get("abuse_score", 0),
        1 if data.get("is_malicious") else 0,
        data.get("isp", ""),
        data.get("usage_type", ""),
        data.get("total_reports", 0),
        data.get("country_code", ""),
        datetime.utcnow().isoformat(),
        data.get("source", "abuseipdb"),
    ))
    conn.commit()
    conn.close()


def check_ip(ip: str) -> dict:
    """
    Check an IP address against AbuseIPDB.
    Returns a dict with: ip, abuse_score, is_malicious, isp, usage_type,
                         total_reports, country_code, source, cached
    """
    if not ip or _is_private(ip):
        return {"ip": ip, "source": "private", "abuse_score": 0, "is_malicious": False}

    # Try cache first
    cached = _from_cache(ip)
    if cached:
        cached["cached"] = True
        return cached

    if not Config.ABUSEIPDB_KEY:
        return {"ip": ip, "source": "not_configured", "abuse_score": 0, "is_malicious": False}

    try:
        resp = requests.get(
            "https://api.abuseipdb.com/api/v2/check",
            headers={"Key": Config.ABUSEIPDB_KEY, "Accept": "application/json"},
            params={"ipAddress": ip, "maxAgeInDays": 90},
            timeout=5,
        )
        if resp.status_code == 200:
            d = resp.json().get("data", {})
            result = {
                "ip":            ip,
                "abuse_score":   d.get("abuseConfidenceScore", 0),
                "is_malicious":  d.get("abuseConfidenceScore", 0) >= 25,
                "isp":           d.get("isp", ""),
                "usage_type":    d.get("usageType", ""),
                "total_reports": d.get("totalReports", 0),
                "country_code":  d.get("countryCode", ""),
                "source":        "abuseipdb",
                "cached":        False,
            }
        else:
            result = {"ip": ip, "source": "api_error", "abuse_score": 0, "is_malicious": False,
                      "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        result = {"ip": ip, "source": "request_error", "abuse_score": 0, "is_malicious": False,
                  "error": str(e)}

    if result.get("source") == "abuseipdb":
        _save_to_cache(ip, result)

    return result
