"""Local SQLite store: prospects, sent mail, suppressions, inbound mail and change jobs."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS prospects (
    email TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    firm TEXT NOT NULL DEFAULT '',
    suburb TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    personal_line TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    status_at TEXT,
    added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    step INTEGER NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    sent_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suppression (
    email TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inbound (
    message_id TEXT PRIMARY KEY,
    from_addr TEXT NOT NULL,
    subject TEXT NOT NULL,
    kind TEXT NOT NULL,
    prospect_email TEXT,
    drafted TEXT NOT NULL DEFAULT '',
    handled_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    subject TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    acn TEXT NOT NULL DEFAULT '',
    change_type TEXT NOT NULL,
    effective_date TEXT,
    asic_due TEXT,
    status TEXT NOT NULL,
    outstanding TEXT NOT NULL DEFAULT '',
    fields TEXT NOT NULL DEFAULT '{}',
    closed_at TEXT
);
"""

# Statuses that end the outreach sequence for a prospect.
STOPPED = ("replied", "interested", "declined", "unsubscribed", "bounced", "excluded", "client")
STATUSES = ("active",) + STOPPED


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (key, value))


def suppress(conn: sqlite3.Connection, email: str, reason: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO suppression (email, reason, at) VALUES (?, ?, ?)",
        (email.lower(), reason, now_iso()),
    )


def is_suppressed(conn: sqlite3.Connection, email: str) -> bool:
    row = conn.execute("SELECT 1 FROM suppression WHERE email = ?", (email.lower(),)).fetchone()
    return row is not None


def set_status(conn: sqlite3.Connection, email: str, status: str) -> bool:
    if status not in STATUSES:
        raise ValueError(f"unknown status {status!r}; use one of {', '.join(STATUSES)}")
    cur = conn.execute(
        "UPDATE prospects SET status = ?, status_at = ? WHERE email = ?",
        (status, now_iso(), email.lower()),
    )
    return cur.rowcount > 0


def prospect_for_message_ids(conn: sqlite3.Connection, ids: list) -> str | None:
    """The prospect whose outreach email one of these Message-IDs refers to."""
    for message_id in ids:
        row = conn.execute("SELECT email FROM messages WHERE message_id = ?", (message_id,)).fetchone()
        if row:
            return row["email"]
    return None
