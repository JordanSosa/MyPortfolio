"""Test doubles for the mail servers and a ready-made settings folder."""

from __future__ import annotations

import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

DESK_OPS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DESK_OPS))

from deskops.config import load_settings  # noqa: E402

CONFIG = """
[sender]
name = Jordan Example
business = Example Corp-Sec Desk
abn = 12 345 678 901
email = desk@example.org
phone = 02 4600 0000
location = Macarthur, NSW
agent_number = 12345
booking_link = https://cal.example.org/desk

[offer]
desk_fee = 140
founding_discount = 15%

[mail]
username = desk@example.org
password = app-password
smtp_host = smtp.example.org
smtp_port = 587
imap_host = imap.example.org
imap_port = 993
inbox_folder = INBOX
drafts_folder = [Gmail]/Drafts
sent_folder =

[outreach]
daily_limit = 15
followup_after_business_days = 4
max_emails_per_firm = 2
min_delay_seconds = 0
max_delay_seconds = 0
send_window = 08:30-15:30
holidays = 2026-12-25, 2026-12-28
quiet_periods = 2026-12-19..2027-01-10

[ai]
enabled = false
"""


def make_settings(home: Path, config: str = CONFIG, prospects: str | None = None):
    (home / "config.ini").write_text(config, encoding="utf-8")
    if prospects is not None:
        (home / "prospects.csv").write_text(prospects, encoding="utf-8")
    return load_settings(home=home, root=DESK_OPS)


class FakeSMTP:
    def __init__(self):
        self.sent = []
        self.closed = False

    def send_message(self, message):
        self.sent.append(message)

    def quit(self):
        self.closed = True


class FakeIMAP:
    """Just enough IMAP4 for fetch_since and append."""

    def __init__(self, inbox_messages=()):
        self.folders = {"INBOX": [bytes(m) for m in inbox_messages], "[Gmail]/Drafts": []}
        self.selected = None
        self.full_fetches = 0

    @staticmethod
    def _unquote(name):
        return name[1:-1].replace('\\"', '"').replace("\\\\", "\\") if name.startswith('"') else name

    def select(self, mailbox, readonly=False):
        name = self._unquote(mailbox)
        if name not in self.folders:
            return "NO", [b"no such folder"]
        self.selected = name
        return "OK", [str(len(self.folders[name])).encode()]

    def uid(self, command, *args):
        messages = self.folders[self.selected]
        if command == "SEARCH":
            return "OK", [" ".join(str(i + 1) for i in range(len(messages))).encode()]
        if command == "FETCH":
            raw = messages[int(args[0]) - 1]
            if "HEADER.FIELDS" in args[1]:
                header = next((line for line in raw.split(b"\n") if line.lower().startswith(b"message-id:")), b"")
                return "OK", [(b"1 (UID 1 BODY[HEADER.FIELDS (MESSAGE-ID)] {%d}" % len(header), header + b"\r\n\r\n"), b")"]
            self.full_fetches += 1
            return "OK", [(b"1 (UID 1 BODY[] {%d}" % len(raw), raw), b")"]
        raise AssertionError(f"unexpected UID command {command}")

    def append(self, mailbox, flags, date_time, message_bytes):
        self.folders.setdefault(self._unquote(mailbox), []).append(message_bytes)
        return "OK", [b"APPEND completed"]

    def logout(self):
        return "BYE", []


def email_from(sender: str, subject: str, body: str, *, to: str = "desk@example.org", headers: dict | None = None) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="sender.example")
    for key, value in (headers or {}).items():
        message[key] = value
    message.set_content(body)
    return message
