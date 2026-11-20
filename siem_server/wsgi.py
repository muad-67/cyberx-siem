"""
wsgi.py — production entry point.

    pip install -r requirements-prod.txt
    SIEM_DEBUG=0 gunicorn -k gthread --threads 64 -w 1 -b 0.0.0.0:5000 wsgi:app

One worker with many threads: the live stream (SSE) keeps a connection open per
dashboard, and the background workers (retention, syslog) must run only once.
"""

from app import create_app
from database import init_db, seed_default_users
from services.retention import start_retention_worker
from services.syslog_receiver import start_syslog_receiver

init_db()
seed_default_users()
start_retention_worker()
start_syslog_receiver()

app = create_app()
