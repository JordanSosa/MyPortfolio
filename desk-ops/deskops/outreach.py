"""Outreach: validate the prospect list, decide who is due, compose and send.

Only addresses a person has collected by hand from a firm's own published
contact details go in prospects.csv. The Spam Act bans address-harvesting
software and harvested lists, so this module never searches for addresses.
"""

from __future__ import annotations

import csv
import random
import re
import smtplib
import time
from dataclasses import dataclass
from datetime import date, datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate
from pathlib import Path
from urllib.parse import urlparse

from . import bizdays, mail, store, templates
from .config import Settings

CSV_FIELDS = (
    "email", "first_name", "firm", "suburb", "website", "source_url",
    "no_objection_checked", "personal_line", "notes", "do_not_contact",
)
EMAIL_RE = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$")
FREE_MAIL = {
    "gmail.com", "outlook.com", "hotmail.com", "live.com", "live.com.au", "yahoo.com", "yahoo.com.au",
    "icloud.com", "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au", "tpg.com.au",
}
YES = {"yes", "y", "true", "1"}


class SendBlocked(Exception):
    """Live sending can't go ahead; the message says why."""


@dataclass
class Issue:
    line: int
    email: str
    message: str

    def __str__(self) -> str:
        return f"line {self.line} ({self.email or 'no email'}): {self.message}"


@dataclass
class Due:
    prospect: dict
    step: int
    first: dict | None  # the first email in the thread, for follow-ups


def read_prospects(path: Path) -> list:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        missing = [f for f in ("email", "firm", "source_url", "no_objection_checked") if f not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path.name} is missing column(s): {', '.join(missing)}. Start from prospects.example.csv.")
        rows = []
        for line, row in enumerate(reader, start=2):
            clean = {key: (row.get(key) or "").strip() for key in CSV_FIELDS}
            clean["email"] = clean["email"].lower()
            clean["_line"] = line
            if any(clean[k] for k in CSV_FIELDS):
                rows.append(clean)
        return rows


def _domain(value: str) -> str:
    host = urlparse(value if "://" in value else f"https://{value}").hostname or ""
    return host.lower().removeprefix("www.")


def validate(rows: list) -> tuple:
    """Errors block sending; warnings are worth a look."""
    errors, warnings, seen = [], [], {}
    for row in rows:
        line, addr = row["_line"], row["email"]
        if row["do_not_contact"].lower() in YES:
            continue
        if not EMAIL_RE.match(addr):
            errors.append(Issue(line, addr, "email address doesn't look valid"))
        if addr in seen:
            errors.append(Issue(line, addr, f"duplicate of line {seen[addr]}"))
        seen.setdefault(addr, line)
        if not row["firm"]:
            errors.append(Issue(line, addr, "firm is empty"))
        if not row["source_url"].lower().startswith(("http://", "https://")):
            errors.append(Issue(line, addr, "source_url must be the web page where the firm publishes this address"))
        if row["no_objection_checked"].lower() not in YES:
            errors.append(Issue(
                line, addr,
                "no_objection_checked must be yes: confirm the page doesn't say it wants no unsolicited email",
            ))
        if not row["first_name"]:
            warnings.append(Issue(line, addr, "no first_name, so the email opens with 'Hello,'"))
        email_domain = addr.split("@")[-1]
        site = _domain(row["website"] or row["source_url"])
        if email_domain not in FREE_MAIL and site and not (email_domain == site or email_domain.endswith("." + site) or site.endswith("." + email_domain)):
            warnings.append(Issue(line, addr, f"email domain {email_domain} doesn't match the website {site}"))
    return errors, warnings


def import_prospects(conn, rows: list) -> dict:
    added = updated = excluded = 0
    for row in rows:
        addr = row["email"]
        if not addr:
            continue
        exists = conn.execute("SELECT status FROM prospects WHERE email = ?", (addr,)).fetchone()
        values = (row["first_name"], row["firm"], row["suburb"], row["website"], row["source_url"],
                  row["personal_line"], row["notes"], addr)
        if exists:
            conn.execute(
                "UPDATE prospects SET first_name=?, firm=?, suburb=?, website=?, source_url=?, personal_line=?, notes=? "
                "WHERE email=?", values)
            updated += 1
        else:
            conn.execute(
                "INSERT INTO prospects (first_name, firm, suburb, website, source_url, personal_line, notes, email, added_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", values + (store.now_iso(),))
            added += 1
        if row["do_not_contact"].lower() in YES:
            store.set_status(conn, addr, "excluded")
            excluded += 1
        elif exists and exists["status"] == "excluded" and not store.is_suppressed(conn, addr):
            store.set_status(conn, addr, "active")
    conn.commit()
    return {"added": added, "updated": updated, "excluded": excluded}


def sent_on(conn, day: date) -> int:
    row = conn.execute("SELECT COUNT(*) AS n FROM messages WHERE substr(sent_at, 1, 10) = ?", (day.isoformat(),)).fetchone()
    return row["n"]


def due(conn, settings: Settings, today: date) -> list:
    """Follow-ups first (they're time-sensitive), then first emails, within today's limit."""
    capacity = max(0, settings.daily_limit - sent_on(conn, today))
    followups, firsts = [], []
    for prospect in conn.execute("SELECT * FROM prospects WHERE status = 'active' ORDER BY added_at, email"):
        prospect = dict(prospect)
        if store.is_suppressed(conn, prospect["email"]):
            continue
        sent = [dict(r) for r in conn.execute(
            "SELECT step, message_id, subject, sent_at FROM messages WHERE email = ? ORDER BY step", (prospect["email"],))]
        if not sent:
            firsts.append(Due(prospect, 1, None))
            continue
        last = sent[-1]
        if last["step"] >= settings.max_touches:
            continue
        last_day = date.fromisoformat(last["sent_at"][:10])
        if bizdays.business_days_after(last_day, today, settings.holidays) >= settings.followup_after_days:
            followups.append(Due(prospect, last["step"] + 1, sent[0]))
    return (followups + firsts)[:capacity]


def window_problem(settings: Settings, now: datetime) -> str | None:
    today = now.date()
    if not bizdays.is_business_day(today, settings.holidays):
        return "today isn't a business day"
    if bizdays.in_quiet_period(today, settings.quiet_periods):
        return "today is inside a quiet period"
    if not settings.window_start <= now.time() <= settings.window_end:
        return f"it's outside the send window ({settings.window_start:%H:%M}-{settings.window_end:%H:%M})"
    return None


def compose(settings: Settings, item: Due) -> EmailMessage:
    prospect = item.prospect
    name = "outreach_initial.txt" if item.step == 1 else "outreach_followup.txt"
    subject_t, body_t = templates.load(settings, name)
    _, footer_t = templates.load(settings, "outreach_footer.txt")
    values = dict(settings.identity())
    values.update(
        first_name=prospect["first_name"],
        firm=prospect["firm"],
        suburb=prospect["suburb"],
        greeting=templates.greeting(prospect["first_name"]),
        personal_line=templates.paragraph(prospect["personal_line"]),
        initial_subject=item.first["subject"] if item.first else "",
    )
    message = EmailMessage()
    message["From"] = formataddr((settings.sender_name, settings.desk_email))
    message["To"] = formataddr((prospect["first_name"], prospect["email"])) if prospect["first_name"] else prospect["email"]
    message["Subject"] = templates.fill(subject_t, values)
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = mail.new_message_id(settings.desk_email)
    message["List-Unsubscribe"] = f"<mailto:{settings.desk_email}?subject=unsubscribe>"
    if item.first:
        message["In-Reply-To"] = item.first["message_id"]
        message["References"] = item.first["message_id"]
    message.set_content(templates.fill(body_t, values) + "\n\n" + templates.fill(footer_t, values) + "\n")
    return message


def send(conn, settings: Settings, *, live: bool, now: datetime, limit: int | None = None,
         smtp_factory=None, on_sent=None, sleep=None, out=print) -> list:
    """Send (or preview) what's due. Returns the composed messages."""
    batch = due(conn, settings, now.date())
    if limit is not None:
        batch = batch[:limit]
    if not batch:
        out("Nothing due to send.")
        return []
    if live:
        unfilled = settings.unfilled_identity()
        if unfilled:
            raise SendBlocked("Fill in these [sender] details in config.ini first: " + ", ".join(unfilled))
    composed = [(item, compose(settings, item)) for item in batch]
    if not live:
        preview_dir = settings.data_dir / "preview"
        preview_dir.mkdir(parents=True, exist_ok=True)
        for item, message in composed:
            path = preview_dir / f"{now:%Y%m%d}-{item.prospect['email']}-email{item.step}.eml"
            path.write_bytes(bytes(message))
            out(f"  preview  email {item.step}  {item.prospect['firm']:<32.32}  {item.prospect['email']}")
        out(f"Previewed {len(composed)} email(s) in {preview_dir}. Nothing was sent; add --live to send.")
        return [m for _, m in composed]

    sleep = sleep or time.sleep
    smtp = smtp_factory(settings)
    try:
        for index, (item, message) in enumerate(composed):
            try:
                smtp.send_message(message)
            except smtplib.SMTPRecipientsRefused:
                store.set_status(conn, item.prospect["email"], "bounced")
                store.suppress(conn, item.prospect["email"], "refused by mail server")
                conn.commit()
                out(f"  refused  email {item.step}  {item.prospect['firm']:<32.32}  {item.prospect['email']} (marked bounced)")
                continue
            conn.execute(
                "INSERT INTO messages (email, step, message_id, subject, sent_at) VALUES (?, ?, ?, ?, ?)",
                (item.prospect["email"], item.step, message["Message-ID"], str(message["Subject"]),
                 now.isoformat(timespec="seconds")),
            )
            conn.commit()
            if on_sent:
                on_sent(message)
            out(f"  sent     email {item.step}  {item.prospect['firm']:<32.32}  {item.prospect['email']}")
            if index < len(composed) - 1:
                sleep(random.uniform(settings.min_delay, settings.max_delay))
    finally:
        try:
            smtp.quit()
        except Exception:  # the connection may already be gone; nothing to clean up
            pass
    sent = conn.execute("SELECT COUNT(*) AS n FROM messages WHERE sent_at = ?", (now.isoformat(timespec="seconds"),)).fetchone()["n"]
    out(f"Sent {sent} email(s).")
    return [m for _, m in composed]


def pipeline(conn) -> dict:
    counts = {status: 0 for status in store.STATUSES}
    for row in conn.execute("SELECT status, COUNT(*) AS n FROM prospects GROUP BY status"):
        counts[row["status"]] = row["n"]
    contacted = conn.execute("SELECT COUNT(DISTINCT email) AS n FROM messages").fetchone()["n"]
    return {"total": sum(counts.values()), "contacted": contacted, **counts}
