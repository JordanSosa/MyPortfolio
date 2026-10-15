"""The daily digest: what's due, what's waiting on you, and what's at risk."""

from __future__ import annotations

from datetime import date, timedelta

from . import outreach
from .config import Settings

# ASIC late fees for a Form 484, 2026-27.
LATE_FEE_FIRST_MONTH = 102
LATE_FEE_AFTER = 428


def build(conn, settings: Settings, today: date) -> str:
    lines = [f"Desk digest, {today:%A %d %B %Y}", ""]

    due = outreach.due(conn, settings, today)
    first = sum(1 for item in due if item.step == 1)
    follow = len(due) - first
    p = outreach.pipeline(conn)
    lines += [
        "OUTREACH",
        f"  Due today: {first} first email(s), {follow} follow-up(s) (daily limit {settings.daily_limit})",
        f"  Pipeline: {p['total']} prospects, {p['contacted']} contacted, {p['replied']} replied, "
        f"{p['interested']} interested, {p['client']} clients, {p['declined']} declined, "
        f"{p['unsubscribed']} unsubscribed, {p['bounced']} bounced",
    ]
    finished = conn.execute(
        "SELECT COUNT(*) AS n FROM prospects p WHERE status = 'active' AND "
        "(SELECT MAX(step) FROM messages m WHERE m.email = p.email) >= ?", (settings.max_touches,)).fetchone()["n"]
    if finished:
        lines.append(f"  Sequence finished with no reply: {finished}")
    week_ago = (today - timedelta(days=7)).isoformat()
    opted_out = conn.execute(
        "SELECT email, reason FROM suppression WHERE at >= ? AND reason IN ('unsubscribe request', 'declined') "
        "ORDER BY at DESC", (week_ago,)).fetchall()
    if opted_out:
        lines.append("  Opted out this week (check none was misread):")
        lines += [f"    - {row['email']} ({row['reason']})" for row in opted_out]
    replies = conn.execute(
        "SELECT p.first_name, p.firm, p.email, p.status_at FROM prospects p WHERE p.status = 'replied' "
        "ORDER BY p.status_at DESC LIMIT 10").fetchall()
    if replies:
        lines.append("  Replies waiting on you (a draft is in your Drafts folder):")
        for row in replies:
            who = f"{row['first_name']}, {row['firm']}" if row["first_name"] else row["firm"]
            lines.append(f"    - {who} <{row['email']}>, replied {row['status_at'][:10]}")
        lines.append("    After you answer, mark them: python3 desk.py mark EMAIL interested (or declined)")
    lines.append("")

    jobs = conn.execute("SELECT * FROM jobs WHERE status != 'closed' ORDER BY asic_due IS NULL, asic_due").fetchall()
    lines.append("CHANGE REQUESTS")
    if not jobs:
        lines.append("  No open jobs.")
    for job in jobs:
        label = f"#{job['id']} {job['company'] or 'unnamed company'}: {job['change_type']}"
        status = job["status"]
        if job["asic_due"]:
            due_day = date.fromisoformat(job["asic_due"])
            days = (due_day - today).days
            if days < 0:
                late_by = (today - due_day).days
                fee = LATE_FEE_FIRST_MONTH if late_by <= 31 else LATE_FEE_AFTER
                timing = f"OVERDUE by {late_by} day(s), ASIC late fee about ${fee}"
            elif days <= 7:
                timing = f"ASIC deadline in {days} day(s) ({due_day:%a %d %b})"
            else:
                timing = f"ASIC deadline {due_day:%d %b}"
        else:
            timing = "no deadline set"
        lines.append(f"  {label}. {status}; {timing}")
        if job["outstanding"]:
            lines.append(f"      still needed: {job['outstanding']}")
    if jobs:
        lines.append("  Close a job once lodged: python3 desk.py jobs --close ID")
    lines.append("")

    since = (today - timedelta(days=1)).isoformat()
    drafted = conn.execute(
        "SELECT drafted, COUNT(*) AS n FROM inbound WHERE drafted != '' AND handled_at >= ? GROUP BY drafted",
        (since,)).fetchall()
    counts = {row["drafted"]: row["n"] for row in drafted}
    lines.append("INBOX (last 24 hours)")
    lines.append(f"  Drafts waiting: {sum(counts.values())} ({counts.get('ai', 0)} written by AI; read every one before sending)")
    return "\n".join(lines) + "\n"
