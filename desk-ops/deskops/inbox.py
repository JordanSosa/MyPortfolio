"""Inbox triage: read new mail, update the pipeline, and leave reply drafts.

Each message gets exactly one outcome:
  bounce           -> prospect marked bounced, never emailed again
  auto-reply       -> noted, sequence continues
  unsubscribe      -> prospect suppressed, no reply
  decline          -> prospect suppressed, no reply
  prospect reply   -> sequence stops, reply drafted
  change request   -> checked against the template, job tracked, reply drafted
  client email     -> template reply drafted; never sent to the AI
  bulk mail        -> ignored
  anything else    -> treated as an enquiry, reply drafted
Nothing is ever sent from here. Drafts wait in the Drafts folder.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from email.message import EmailMessage
from email.utils import formataddr, formatdate

from . import intake, mail, store, templates
from .config import Settings
from .drafter import Drafter


@dataclass
class Summary:
    seen: int = 0
    outcomes: dict = field(default_factory=dict)
    drafts: int = 0
    ai_drafts: int = 0
    notes: list = field(default_factory=list)

    def add(self, outcome: str) -> None:
        self.outcomes[outcome] = self.outcomes.get(outcome, 0) + 1


def _first_name(display_name: str) -> str:
    name = re.sub(r"[\"']", "", display_name or "").strip()
    if "," in name:  # "Citizen, Jane"
        name = name.split(",", 1)[1].strip()
    first = name.split()[0] if name.split() else ""
    return first if first.isalpha() and first.lower() not in {"the", "accounts", "admin", "info", "office"} else ""


def _reply_shell(settings: Settings, original, body: str) -> EmailMessage:
    """A reply addressed to the sender, threaded under their email."""
    name, addr = mail.sender(original)
    subject = str(original.get("Subject", "")).strip()
    reply = EmailMessage()
    reply["From"] = formataddr((settings.sender_name, settings.desk_email))
    reply["To"] = formataddr((name, addr)) if name else addr
    reply["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    reply["Date"] = formatdate(localtime=True)
    reply["Message-ID"] = mail.new_message_id(settings.desk_email)
    original_id = str(original.get("Message-ID", "")).strip()
    if original_id:
        reply["In-Reply-To"] = original_id
        reply["References"] = " ".join(mail.referenced_ids(original)[-5:] + [original_id])
    reply.set_content(body.rstrip() + "\n")
    return reply


def _template_reply(settings: Settings, name: str, extra: dict) -> str:
    _, body = templates.load(settings, name)
    values = dict(settings.identity())
    values.update(extra)
    return templates.fill(body, values)


def _since(conn, today: date) -> date:
    """Read back at least two weeks, and further if the last run was longer ago than that."""
    floor = today - timedelta(days=14)
    last_run = store.get_meta(conn, "last_inbox_run")
    if last_run:
        return min(floor, date.fromisoformat(last_run) - timedelta(days=3))
    first_sent = conn.execute("SELECT MIN(substr(sent_at, 1, 10)) AS first FROM messages").fetchone()["first"]
    return min(floor, date.fromisoformat(first_sent)) if first_sent else floor


def process(conn, settings: Settings, imap, *, today: date, drafter: Drafter | None = None,
            save_drafts: bool = True) -> Summary:
    summary = Summary()
    drafter = drafter or Drafter(settings)
    def handled(message_id: str) -> bool:
        return conn.execute("SELECT 1 FROM inbound WHERE message_id = ?", (message_id,)).fetchone() is not None

    messages = mail.fetch_since(imap, settings.inbox_folder, _since(conn, today), skip=handled)
    own = settings.desk_email.lower()
    for message in messages:
        message_id = str(message.get("Message-ID", "")).strip()
        if not message_id:
            continue
        if conn.execute("SELECT 1 FROM inbound WHERE message_id = ?", (message_id,)).fetchone():
            continue
        name, addr = mail.sender(message)
        if addr == own:
            continue
        summary.seen += 1
        subject = str(message.get("Subject", "")).strip()
        outcome, prospect, draft_body, used_ai = _triage(conn, settings, drafter, message, name, addr, subject, summary)
        drafted = ""
        if draft_body:
            if save_drafts:
                mail.append(imap, settings.drafts_folder, _reply_shell(settings, message, draft_body))
            summary.drafts += 1
            summary.ai_drafts += int(used_ai)
            drafted = "ai" if used_ai else "template"
        conn.execute(
            "INSERT INTO inbound (message_id, from_addr, subject, kind, prospect_email, drafted, handled_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (message_id, addr, subject[:300], outcome, prospect, drafted, store.now_iso()))
        conn.commit()
        summary.add(outcome)
    store.set_meta(conn, "last_inbox_run", today.isoformat())
    conn.commit()
    if drafter.last_error:
        summary.notes.append(f"AI drafting fell back to templates: {drafter.last_error}")
    return summary


def _triage(conn, settings, drafter, message, name, addr, subject, summary) -> tuple:
    """Returns (outcome, prospect email or None, draft body or None, drafted by AI)."""
    bounced = mail.bounce_recipients(message)
    if bounced:
        hits = [a for a in bounced if conn.execute("SELECT 1 FROM prospects WHERE email = ?", (a,)).fetchone()]
        for hit in hits:
            store.set_status(conn, hit, "bounced")
            store.suppress(conn, hit, "bounced")
        return "bounce", (hits[0] if hits else None), None, False

    prospect_row = conn.execute("SELECT * FROM prospects WHERE email = ?", (addr,)).fetchone()
    prospect = prospect_row["email"] if prospect_row else store.prospect_for_message_ids(conn, mail.referenced_ids(message))
    if prospect and prospect_row is None:
        prospect_row = conn.execute("SELECT * FROM prospects WHERE email = ?", (prospect,)).fetchone()

    if mail.is_auto_reply(message):
        return "auto-reply", prospect, None, False

    text = mail.text_of(message)
    fresh = mail.new_text(text) or text

    if intake.looks_like_change_request(subject, fresh):
        return _change_request(conn, settings, name, addr, subject, fresh, summary)

    if prospect_row is not None and prospect_row["status"] == "client":
        # Client mail can carry personal details, so it never goes to the AI drafter.
        first = prospect_row["first_name"] or _first_name(name)
        return "client email", prospect, _template_reply(
            settings, "reply_enquiry.txt", {"greeting": templates.greeting(first)}), False

    if prospect:
        if mail.wants_unsubscribe(fresh) or mail.wants_unsubscribe(subject):
            store.set_status(conn, prospect, "unsubscribed")
            store.suppress(conn, prospect, "unsubscribe request")
            if addr != prospect:
                store.suppress(conn, addr, "unsubscribe request")
            return "unsubscribe", prospect, None, False
        if mail.declines(fresh):
            store.set_status(conn, prospect, "declined")
            store.suppress(conn, prospect, "declined")
            return "decline", prospect, None, False
        if prospect_row is not None and prospect_row["status"] == "active":
            store.set_status(conn, prospect, "replied")
        firm = prospect_row["firm"] if prospect_row is not None else ""
        first = (prospect_row["first_name"] if prospect_row is not None else "") or _first_name(name)
        body = drafter.draft(situation="They replied to our first outreach email about the desk.",
                             from_name=name, firm=firm, subject=subject, body=fresh)
        if body:
            return "prospect reply", prospect, body, True
        return "prospect reply", prospect, _template_reply(
            settings, "reply_prospect.txt", {"greeting": templates.greeting(first)}), False

    if mail.is_bulk(message):
        return "bulk", None, None, False

    if mail.wants_unsubscribe(fresh) or mail.wants_unsubscribe(subject):
        store.suppress(conn, addr, "unsubscribe request")
        return "unsubscribe", None, None, False

    body = drafter.draft(situation="A new email to the desk that isn't a reply to our outreach.",
                         from_name=name, firm="", subject=subject, body=fresh)
    if body:
        return "enquiry", None, body, True
    return "enquiry", None, _template_reply(
        settings, "reply_enquiry.txt", {"greeting": templates.greeting(_first_name(name))}), False


def _change_request(conn, settings, name, addr, subject, text, summary) -> tuple:
    assessment = intake.assess(intake.parse_fields(text))
    job_id, assessment = intake.record(conn, assessment, from_addr=addr, subject=subject)
    extra = {
        "greeting": templates.greeting(_first_name(name)),
        "change_type": assessment.change_type,
        "company": assessment.fields.get("company name") or "the company",
    }
    if assessment.complete:
        extra.update(
            effective=assessment.effective.strftime("%d/%m/%Y") if assessment.effective else "not given",
            asic_due=assessment.asic_due.strftime("%A %d %B %Y") if assessment.asic_due else "not set",
        )
        body = _template_reply(settings, "reply_change_ready.txt", extra)
    else:
        extra["outstanding"] = "\n".join(f"- {item}" for item in assessment.outstanding())
        body = _template_reply(settings, "reply_change_missing.txt", extra)
    summary.notes.append(f"Change job #{job_id}: {assessment.change_type} for {extra['company']} "
                         f"({'ready to prepare' if assessment.complete else 'waiting on the firm'})")
    return "change request", None, body, False
