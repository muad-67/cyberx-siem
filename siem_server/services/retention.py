"""
services/retention.py
Log retention and archiving for CyberX SIEM.

Moves logs older than LOG_RETENTION_DAYS from the live DB to an archive DB.
Called as a background thread at startup, then runs every 24 hours.
"""

from __future__ import annotations
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from config import Config


def _archive_old_logs():
    """Move logs older than retention period to the archive database."""
    cutoff = (datetime.utcnow() - timedelta(days=Config.LOG_RETENTION_DAYS)).isoformat()

    # Connect to both databases
    live_conn    = sqlite3.connect(Config.DB_PATH)
    archive_conn = sqlite3.connect(Config.ARCHIVE_DB_PATH)
    archive_conn.execute("PRAGMA journal_mode=WAL")

    # Ensure archive table exists
    archive_conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_logs (
            id INTEGER, timestamp TEXT, source_ip TEXT, hostname TEXT,
            log_type TEXT, severity TEXT, message TEXT, raw_data TEXT,
            country TEXT, city TEXT, isp TEXT, created_at DATETIME,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    archive_conn.commit()

    # Fetch old logs
    rows = live_conn.execute(
        "SELECT * FROM raw_logs WHERE created_at < ?", (cutoff,)
    ).fetchall()

    if rows:
        archive_conn.executemany(
            """INSERT OR IGNORE INTO raw_logs
               (id, timestamp, source_ip, hostname, log_type, severity,
                message, raw_data, country, city, isp, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            [tuple(r) for r in rows],
        )
        archive_conn.commit()

        live_conn.execute("DELETE FROM raw_logs WHERE created_at < ?", (cutoff,))
        live_conn.execute("VACUUM")
        live_conn.commit()
        print(f"[RETENTION] Archived {len(rows)} logs older than {Config.LOG_RETENTION_DAYS} days.")

    live_conn.close()
    archive_conn.close()


def get_storage_stats() -> dict:
    """Return live DB stats: log count, DB file size, oldest/newest timestamps."""
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT COUNT(*) as total, MIN(created_at) as oldest, MAX(created_at) as newest FROM raw_logs"
    ).fetchone()
    conn.close()

    import os
    db_size_bytes = os.path.getsize(Config.DB_PATH) if os.path.exists(Config.DB_PATH) else 0
    return {
        "total_logs":       row["total"],
        "oldest_log":       row["oldest"],
        "newest_log":       row["newest"],
        "db_size_mb":       round(db_size_bytes / (1024 * 1024), 2),
        "retention_days":   Config.LOG_RETENTION_DAYS,
    }


def _retention_loop():
    """Run archiving immediately at startup, then every 24 hours."""
    while True:
        try:
            _archive_old_logs()
        except Exception as e:
            print(f"[RETENTION] Error during archiving: {e}")
        time.sleep(86400)  # 24 hours


def start_retention_worker():
    """Launch the retention loop as a daemon background thread."""
    t = threading.Thread(target=_retention_loop, daemon=True, name="retention-worker")
    t.start()
    print("[RETENTION] Background retention worker started.")
