"""
services/geo.py
IP Geolocation enrichment using ip-api.com (free, no API key required).

Caches results in memory to avoid hammering the API for the same IP.
Private/reserved IPs are detected locally without any HTTP call.
"""

from __future__ import annotations
import ipaddress
import requests
from threading import Lock

_cache: dict[str, dict] = {}
_lock = Lock()

_PRIVATE_RESULT = {"country": "Private", "city": "LAN", "isp": "Internal Network"}
_UNKNOWN_RESULT  = {"country": "Unknown", "city": "Unknown", "isp": "Unknown"}

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_private(ip: str) -> bool:
    """Return True if IP is a private/loopback address."""
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return False


def lookup(ip: str) -> dict:
    """
    Return geo info for an IP: {"country": ..., "city": ..., "isp": ...}
    Results are cached for the lifetime of the process.
    """
    if not ip or ip in ("unknown", "localhost"):
        return _UNKNOWN_RESULT

    with _lock:
        if ip in _cache:
            return _cache[ip]

    if _is_private(ip):
        with _lock:
            _cache[ip] = _PRIVATE_RESULT
        return _PRIVATE_RESULT

    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?fields=country,city,isp,status",
            timeout=3,
        )
        data = resp.json()
        if data.get("status") == "success":
            result = {
                "country": data.get("country", "Unknown"),
                "city":    data.get("city", "Unknown"),
                "isp":     data.get("isp", "Unknown"),
            }
        else:
            result = _UNKNOWN_RESULT
    except Exception:
        result = _UNKNOWN_RESULT

    with _lock:
        _cache[ip] = result
    return result
