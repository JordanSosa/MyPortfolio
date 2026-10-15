"""SMTP and IMAP plumbing, plus helpers for reading what arrives."""

from __future__ import annotations

import email
import email.policy
import html
import imaplib
import re
import smtplib
import ssl
import time
from datetime import date
from email.message import EmailMessage
from email.utils import getaddresses, make_msgid, parseaddr

from .config import Settings

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
EMAIL_PATTERN = re.compile(r"[\w.+'-]+@[\w-]+(?:\.[\w-]+)+")
QUOTE_START = re.compile(
    r"^(?:On .{4,200} wrote:\s*$|-{2,}\s*Original Message\s*-{2,}|_{5,}\s*$|From: .+$|Sent from my )",
    re.IGNORECASE,
)


class MailError(Exception):
    """The mailbox refused a login or a command."""


def smtp_connect(settings: Settings) -> smtplib.SMTP:
    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, 465, context=context, timeout=30)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
        server.login(settings.mail_username, settings.mail_password)
    except smtplib.SMTPAuthenticationError as exc:
        raise MailError("SMTP login failed. Check the username and app password.") from exc
    except (OSError, smtplib.SMTPException) as exc:
        raise MailError(f"Couldn't connect to {settings.smtp_host}: {exc}") from exc
    return server


def imap_connect(settings: Settings) -> imaplib.IMAP4_SSL:
    try:
        imap = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port, ssl_context=ssl.create_default_context())
        imap.login(settings.mail_username, settings.mail_password)
    except imaplib.IMAP4.error as exc:
        raise MailError("IMAP login failed. Check the username, app password and that IMAP is on.") from exc
    except OSError as exc:
        raise MailError(f"Couldn't connect to {settings.imap_host}: {exc}") from exc
    return imap


def new_message_id(address: str) -> str:
    domain = address.rsplit("@", 1)[-1] if re.fullmatch(r"[^@\s\[\]]+@[\w.-]+", address or "") else "localhost"
    return make_msgid(domain=domain)


def quote_mailbox(name: str) -> str:
    return '"' + name.replace("\\", "\\\\").replace('"', '\\"') + '"'


def imap_date(day: date) -> str:
    return f"{day.day:02d}-{MONTHS[day.month - 1]}-{day.year}"


def _header_message_id(imap, uid) -> str:
    status, parts = imap.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
    raw = next((part[1] for part in parts if isinstance(part, tuple)), b"") if status == "OK" else b""
    headers = email.message_from_bytes(raw or b"", policy=email.policy.default)
    return str(headers.get("Message-ID", "")).strip()


def fetch_since(imap, folder: str, since: date, skip=None) -> list:
    """Messages received on or after `since`, fetched without marking them read.

    `skip(message_id)` returning True leaves a message undownloaded, so attachments
    already handled on an earlier run aren't fetched again.
    """
    status, _ = imap.select(quote_mailbox(folder), readonly=True)
    if status != "OK":
        raise MailError(f"Couldn't open the {folder} folder")
    status, data = imap.uid("SEARCH", None, "SINCE", imap_date(since))
    if status != "OK":
        raise MailError("The mailbox refused a search")
    messages = []
    for uid in (data[0] or b"").split():
        if skip is not None:
            message_id = _header_message_id(imap, uid)
            if message_id and skip(message_id):
                continue
        status, parts = imap.uid("FETCH", uid, "(BODY.PEEK[])")
        if status != "OK":
            continue
        raw = next((part[1] for part in parts if isinstance(part, tuple)), None)
        if raw:
            messages.append(email.message_from_bytes(raw, policy=email.policy.default))
    return messages


def append(imap, folder: str, message: EmailMessage, flags: str = "(\\Draft)") -> None:
    status, _ = imap.append(
        quote_mailbox(folder), flags, imaplib.Time2Internaldate(time.time()), message.as_bytes()
    )
    if status != "OK":
        raise MailError(f"Couldn't save to the {folder} folder. Check drafts_folder / sent_folder in config.ini.")


def sender(message) -> tuple:
    name, addr = parseaddr(str(message.get("From", "")))
    return name.strip(), addr.strip().lower()


def referenced_ids(message) -> list:
    ids = []
    for header in ("In-Reply-To", "References"):
        ids += re.findall(r"<[^>]+>", str(message.get(header, "")))
    return ids


def addresses(message, header: str) -> list:
    return [addr.lower() for _, addr in getaddresses([str(v) for v in message.get_all(header, [])]) if addr]


def html_to_text(markup: str) -> str:
    markup = re.sub(r"(?is)<(script|style).*?</\1>", "", markup)
    markup = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</tr>", "\n", markup)
    text = html.unescape(re.sub(r"<[^>]+>", "", markup))
    return re.sub(r"[ \t]+", " ", text)


def text_of(message) -> str:
    try:
        part = message.get_body(preferencelist=("plain", "html"))
    except (KeyError, LookupError):
        part = None
    if part is None:
        return ""
    try:
        content = part.get_content()
    except (KeyError, LookupError, UnicodeError):
        payload = part.get_payload(decode=True) or b""
        content = payload.decode(part.get_content_charset() or "utf-8", "replace")
    if part.get_content_type() == "text/html":
        content = html_to_text(content)
    return content.replace("\r\n", "\n")


def new_text(text: str) -> str:
    """The part of a reply the sender wrote, without the quoted thread below it."""
    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(">") or QUOTE_START.match(stripped):
            break
        kept.append(line)
    return "\n".join(kept).strip()


def is_auto_reply(message) -> bool:
    auto = str(message.get("Auto-Submitted", "")).lower()
    if auto and auto != "no":
        return True
    if message.get("X-Autoreply") or message.get("X-Autorespond"):
        return True
    if str(message.get("Precedence", "")).lower() == "auto_reply":
        return True
    subject = str(message.get("Subject", "")).lower()
    return subject.startswith(("automatic reply", "auto-reply", "autoreply", "out of office", "out of the office"))


def is_bulk(message) -> bool:
    """Newsletters, notifications and other mail nobody expects a reply to."""
    _, addr = sender(message)
    if re.search(r"(^|[._-])(no-?reply|do-?not-?reply|notifications?|newsletter)", addr.split("@")[0]):
        return True
    if message.get("List-Unsubscribe") or message.get("List-Id"):
        return True
    return str(message.get("Precedence", "")).lower() in {"bulk", "list", "junk"}


def bounce_recipients(message) -> list:
    """Addresses a delivery-failure report says couldn't be reached. Empty if it isn't one."""
    _, addr = sender(message)
    is_report = (
        message.get_content_type() == "multipart/report"
        and str(message.get_param("report-type", "")).lower() == "delivery-status"
    )
    from_daemon = addr.startswith(("mailer-daemon@", "postmaster@")) or "mailer-daemon" in addr
    if not (is_report or from_daemon):
        return []
    found = []
    failed = message.get("X-Failed-Recipients")
    if failed:
        found += [a.strip().lower() for a in str(failed).split(",") if a.strip()]
    for part in message.walk():
        if part.get_content_type() != "message/delivery-status":
            continue
        payload = part.get_payload()
        blocks = payload if isinstance(payload, list) else []
        for block in blocks:
            for header in ("Final-Recipient", "Original-Recipient"):
                value = block.get(header)
                if value and ";" in str(value):
                    found.append(str(value).split(";", 1)[1].strip().lower())
    if not found:
        found = EMAIL_PATTERN.findall(text_of(message).lower())
    seen, unique = set(), []
    for item in found:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


UNSUBSCRIBE = re.compile(
    r"\b(unsubscribe|remove me|take me off|stop (?:emailing|contacting)|do not (?:email|contact)|don'?t (?:email|contact))\b",
    re.IGNORECASE,
)
DECLINE = re.compile(
    r"\b(not interested|no thanks|no thank you|not for us|we(?:'re| are) (?:all )?(?:sorted|covered)|"
    r"(?:handle|do) (?:it|this|that|these) in[- ]house)\b",
    re.IGNORECASE,
)
OUR_FOOTER = re.compile(r"reply\s+[\"“”']?unsubscribe[\"“”']?\s+and\s+i\s+won", re.IGNORECASE)


def _without_our_footer(text: str) -> str:
    """Drop quoted copies of our own unsubscribe line so they aren't read as the sender's request."""
    return "\n".join(line for line in text.splitlines() if not OUR_FOOTER.search(line))


def wants_unsubscribe(text: str) -> bool:
    return bool(UNSUBSCRIBE.search(_without_our_footer(text)[:600]))


def declines(text: str) -> bool:
    """Only short, plain refusals. Anything longer goes to a person to judge."""
    text = _without_our_footer(text).strip()
    return len(text) <= 300 and bool(DECLINE.search(text))
