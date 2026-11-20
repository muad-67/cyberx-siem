"""
services/notify.py
Alert notifications: webhook (Slack/Discord/Teams-compatible) and email (SMTP).
Everything is optional and configured through environment variables (see config.py).
Delivery runs on a background thread so ingestion never waits on the network.
"""

import json
import smtplib
import threading
from datetime import datetime
from email.message import EmailMessage

import requests
from config import Config

_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def enabled() -> bool:
    return bool(Config.NOTIFY_WEBHOOK_URL or (Config.NOTIFY_SMTP_HOST and Config.NOTIFY_EMAIL_TO))


def should_notify(severity: str, now: datetime | None = None) -> bool:
    """Apply the severity floor and the optional 'off-hours only' rule."""
    if _ORDER.get(severity, 0) < _ORDER.get(Config.NOTIFY_MIN_SEVERITY, 4):
        return False
    if Config.NOTIFY_OFF_HOURS_ONLY:
        hour = (now or datetime.utcnow()).hour
        if 8 <= hour < 18:
            return False
    return True


def _text(alert: dict) -> str:
    return (f"[{alert['severity'].upper()}] {alert['alert_type'].replace('_', ' ').title()} "
            f"from {alert.get('source_ip') or 'unknown'}\n{alert.get('description', '')}\n"
            f"MITRE: {alert.get('mitre_technique') or '-'} | Risk score: {alert.get('risk_score', '-')}")


def _send_webhook(alert: dict):
    try:
        # "text" works for Slack/Teams, "content" for Discord
        requests.post(Config.NOTIFY_WEBHOOK_URL,
                      json={"text": _text(alert), "content": _text(alert)}, timeout=8)
    except Exception as e:
        print(f"[NOTIFY] webhook failed: {e}")


def _send_email(alert: dict):
    try:
        msg = EmailMessage()
        msg["Subject"] = f"[CyberX] {alert['severity'].upper()}: {alert['alert_type']} from {alert.get('source_ip')}"
        msg["From"] = Config.NOTIFY_EMAIL_FROM
        msg["To"] = Config.NOTIFY_EMAIL_TO
        msg.set_content(_text(alert))
        with smtplib.SMTP(Config.NOTIFY_SMTP_HOST, Config.NOTIFY_SMTP_PORT, timeout=10) as s:
            s.starttls()
            if Config.NOTIFY_SMTP_USER:
                s.login(Config.NOTIFY_SMTP_USER, Config.NOTIFY_SMTP_PASSWORD)
            s.send_message(msg)
    except Exception as e:
        print(f"[NOTIFY] email failed: {e}")


def notify_alert(alert: dict) -> bool:
    """Fire-and-forget. Returns True if a notification was dispatched."""
    if not enabled() or not should_notify(alert.get("severity", "info")):
        return False
    if Config.NOTIFY_WEBHOOK_URL:
        threading.Thread(target=_send_webhook, args=(alert,), daemon=True).start()
    if Config.NOTIFY_SMTP_HOST and Config.NOTIFY_EMAIL_TO:
        threading.Thread(target=_send_email, args=(alert,), daemon=True).start()
    return True
