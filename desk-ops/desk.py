#!/usr/bin/env python3
"""Corp-sec desk automation.

Daily routine:
    python3 desk.py daily          # read mail, leave drafts, preview outreach, print the digest
    python3 desk.py send --live    # send the outreach you just previewed

Run `python3 desk.py <command> --help` for any command's options.
"""

from __future__ import annotations

import argparse
import csv
import shutil
import smtplib
import sys
from contextlib import closing
from datetime import date, datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from deskops import digest, inbox, intake, mail, outreach, proposal, store  # noqa: E402
from deskops.config import ConfigError, load_settings  # noqa: E402
from deskops.drafter import Drafter  # noqa: E402
from deskops.templates import TemplateError  # noqa: E402


def cmd_init(args) -> int:
    home = args.home
    home.mkdir(parents=True, exist_ok=True)
    created = []
    for example, target in (("config.example.ini", "config.ini"), ("prospects.example.csv", "prospects.csv")):
        if not (home / target).exists():
            shutil.copyfile(HERE / example, home / target)
            created.append(target)
    (home / "data").mkdir(exist_ok=True)
    print(f"Created {', '.join(created)} in {home}." if created else "config.ini and prospects.csv already exist; nothing changed.")
    print("Next: fill in config.ini, add firms to prospects.csv, then run: python3 desk.py check")
    return 0


def _prospects(settings, conn, *, show_warnings: bool) -> bool:
    """Load prospects.csv into the store. Returns False if errors block outreach."""
    try:
        rows = outreach.read_prospects(settings.prospects_csv)
    except ValueError as exc:
        print(f"prospects.csv: {exc}")
        return False
    if show_warnings:
        print(f"Prospects: {len(rows)} row(s) in prospects.csv.")
    errors, warnings = outreach.validate(rows)
    for issue in errors:
        print(f"  ERROR    {issue}")
    if show_warnings:
        for issue in warnings:
            print(f"  warning  {issue}")
    if errors:
        print(f"Fix {len(errors)} error(s) in prospects.csv before sending.")
        return False
    outreach.import_prospects(conn, rows)
    return True


def _run_inbox(settings, conn, today: date) -> None:
    imap = mail.imap_connect(settings)
    try:
        summary = inbox.process(conn, settings, imap, today=today)
    finally:
        try:
            imap.logout()
        except Exception:  # already disconnected
            pass
    outcomes = ", ".join(f"{count} {kind}" for kind, count in sorted(summary.outcomes.items())) or "nothing new"
    print(f"Inbox: {outcomes}.")
    if summary.drafts:
        print(f"  {summary.drafts} draft(s) saved to {settings.drafts_folder}"
              + (f", {summary.ai_drafts} written by AI. Read each one before sending." if summary.ai_drafts else "."))
    for note in summary.notes:
        print(f"  {note}")


def cmd_check(args, settings) -> int:
    ok = True
    unfilled = settings.unfilled_identity()
    if unfilled:
        print("Still to fill in [sender] in config.ini (live sending is blocked until you do): " + ", ".join(unfilled))
        ok = False
    else:
        print("Sender details: complete.")
    sample = {"email": "jane@example.com", "first_name": "Jane", "firm": "Example Accounting", "suburb": "Campbelltown",
              "personal_line": ""}
    try:
        first = outreach.compose(settings, outreach.Due(sample, 1, None))
        outreach.compose(settings, outreach.Due(sample, 2, {"subject": str(first["Subject"]), "message_id": first["Message-ID"]}))
        print("Templates: render cleanly.")
    except (TemplateError, OSError) as exc:
        print(f"Templates: {exc}")
        ok = False
    with closing(store.connect(settings.db_path)) as conn:
        rows_ok = _prospects(settings, conn, show_warnings=True)
        counts = outreach.pipeline(conn)
    print(f"Pipeline: {counts['active']} active of {counts['total']}." if rows_ok else "Pipeline: not updated.")
    ok = ok and rows_ok
    drafter = Drafter(settings)
    print("AI drafting: on, model " + settings.ai_model if drafter.enabled else f"AI drafting: off ({drafter.off_reason}).")
    if args.no_login:
        return 0 if ok else 1
    try:
        smtp = mail.smtp_connect(settings)
        smtp.quit()
        print(f"SMTP login: OK ({settings.smtp_host}).")
        imap = mail.imap_connect(settings)
        for folder in filter(None, (settings.inbox_folder, settings.drafts_folder, settings.sent_folder)):
            status, _ = imap.select(mail.quote_mailbox(folder), readonly=True)
            print(f"IMAP folder {folder}: {'OK' if status == 'OK' else 'NOT FOUND'}")
            ok = ok and status == "OK"
        imap.logout()
    except mail.MailError as exc:
        print(exc)
        ok = False
    return 0 if ok else 1


def cmd_inbox(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        _prospects(settings, conn, show_warnings=False)
        _run_inbox(settings, conn, date.today())
    return 0


def cmd_send(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        return _send(args, settings, conn)


def _send(args, settings, conn) -> int:
    if not _prospects(settings, conn, show_warnings=False):
        return 1
    now = datetime.now()
    sent_imap = None
    if args.live:
        problem = outreach.window_problem(settings, now)
        if problem and not args.ignore_window:
            print(f"Not sending: {problem}. Add --ignore-window to override.")
            return 1
        if not args.skip_inbox:
            # Catch replies and unsubscribes before anyone gets a follow-up.
            _run_inbox(settings, conn, now.date())
        if settings.sent_folder:
            sent_imap = mail.imap_connect(settings)
    try:
        outreach.send(
            conn, settings, live=args.live, now=now, limit=args.limit, smtp_factory=mail.smtp_connect,
            on_sent=(lambda m: mail.append(sent_imap, settings.sent_folder, m, flags="(\\Seen)")) if sent_imap else None,
        )
    finally:
        if sent_imap is not None:
            sent_imap.logout()
    return 0


def cmd_digest(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        text = digest.build(conn, settings, date.today())
    print(text)
    if args.email:
        message = EmailMessage()
        message["From"] = formataddr((settings.sender_name, settings.desk_email))
        message["To"] = settings.desk_email
        message["Subject"] = f"Desk digest {date.today():%d %b %Y}"
        message["Date"] = formatdate(localtime=True)
        message["Message-ID"] = mail.new_message_id(settings.desk_email)
        message.set_content(text)
        smtp = mail.smtp_connect(settings)
        try:
            smtp.send_message(message)
        finally:
            smtp.quit()
        print(f"Digest emailed to {settings.desk_email}.")
    return 0


def cmd_daily(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        rows_ok = _prospects(settings, conn, show_warnings=False)
        _run_inbox(settings, conn, date.today())
        if rows_ok:
            args.limit, args.ignore_window, args.skip_inbox = None, False, True
            _send(args, settings, conn)
        print()
        print(digest.build(conn, settings, date.today()))
    return 0


def cmd_mark(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        if not store.set_status(conn, args.email, args.status):
            print(f"No prospect with email {args.email}.")
            return 1
        if args.status in ("declined", "unsubscribed", "bounced"):
            store.suppress(conn, args.email, args.status)
        conn.commit()
    print(f"{args.email} is now {args.status}.")
    return 0


def cmd_suppress(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        store.suppress(conn, args.email, args.reason)
        store.set_status(conn, args.email, "excluded")
        conn.commit()
    print(f"{args.email} will never be emailed by the desk.")
    return 0


def cmd_jobs(args, settings) -> int:
    with closing(store.connect(settings.db_path)) as conn:
        return _jobs(args, conn)


def _jobs(args, conn) -> int:
    if args.close is not None:
        if intake.close(conn, args.close):
            print(f"Job #{args.close} closed and its personal details deleted.")
            return 0
        print(f"No open job #{args.close}.")
        return 1
    jobs = conn.execute("SELECT * FROM jobs WHERE status != 'closed' ORDER BY asic_due IS NULL, asic_due").fetchall()
    if not jobs:
        print("No open change jobs.")
    for job in jobs:
        print(f"#{job['id']}  {job['company'] or 'unnamed company'}  ACN {job['acn'] or '?'}  {job['change_type']}  "
              f"{job['status']}  ASIC due {job['asic_due'] or 'n/a'}")
        if job["outstanding"]:
            print(f"     still needed: {job['outstanding']}")
    return 0


def cmd_proposal(args, settings) -> int:
    try:
        start = date.fromisoformat(args.start)
    except ValueError:
        print("--start should be a date like 2027-02-01")
        return 1
    path = proposal.build(settings, firm=args.firm, contact=args.contact, companies=args.companies,
                          start=start, today=date.today())
    print(f"Proposal written to {path}. Open it in a browser and print to PDF.")
    return 0


def cmd_report(args, settings) -> int:
    path = settings.data_dir / "pipeline.csv"
    with closing(store.connect(settings.db_path)) as conn:
        rows = conn.execute(
            "SELECT p.email, p.first_name, p.firm, p.suburb, p.status, p.status_at, "
            "(SELECT COUNT(*) FROM messages m WHERE m.email = p.email) AS emails_sent, "
            "(SELECT MAX(sent_at) FROM messages m WHERE m.email = p.email) AS last_sent "
            "FROM prospects p ORDER BY p.status, p.firm").fetchall()
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["email", "first_name", "firm", "suburb", "status", "status_at", "emails_sent", "last_sent"])
        writer.writerows([tuple(row) for row in rows])
    print(f"Wrote {len(rows)} prospect(s) to {path}.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="desk.py", description="Automation for the corp-sec desk.")
    parser.add_argument("--home", type=Path, default=HERE,
                        help="folder holding config.ini, prospects.csv and data/ (default: this folder)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="create config.ini and prospects.csv from the examples")
    p = sub.add_parser("check", help="check config, templates, prospect list and mailbox login")
    p.add_argument("--no-login", action="store_true", help="skip the SMTP and IMAP login test")
    sub.add_parser("inbox", help="read new mail: replies, bounces, unsubscribes, change requests; save drafts")
    p = sub.add_parser("send", help="send due outreach (a preview unless --live)")
    p.add_argument("--live", action="store_true", help="actually send")
    p.add_argument("--limit", type=int, help="send at most this many now")
    p.add_argument("--ignore-window", action="store_true", help="send outside the window, holidays or quiet periods")
    p.add_argument("--skip-inbox", action="store_true", help="don't check for replies first (not recommended)")
    p = sub.add_parser("digest", help="print what's due, waiting and at risk")
    p.add_argument("--email", action="store_true", help="also email the digest to the desk address")
    p = sub.add_parser("daily", help="inbox, then outreach (preview unless --live), then the digest")
    p.add_argument("--live", action="store_true", help="send due outreach instead of previewing it")
    p = sub.add_parser("mark", help="set a prospect's status after a conversation")
    p.add_argument("email")
    p.add_argument("status", choices=store.STATUSES)
    p = sub.add_parser("suppress", help="never email this address")
    p.add_argument("email")
    p.add_argument("--reason", default="manual")
    p = sub.add_parser("jobs", help="list open change jobs, or close one once lodged")
    p.add_argument("--close", type=int, metavar="ID")
    p = sub.add_parser("proposal", help="write a one-page proposal for a firm")
    p.add_argument("--firm", required=True)
    p.add_argument("--contact", required=True)
    p.add_argument("--companies", type=int, required=True)
    p.add_argument("--start", required=True, help="start date, e.g. 2027-02-01")
    sub.add_parser("report", help="export the pipeline to data/pipeline.csv")
    return parser


COMMANDS = {
    "check": cmd_check, "inbox": cmd_inbox, "send": cmd_send, "digest": cmd_digest, "daily": cmd_daily,
    "mark": cmd_mark, "suppress": cmd_suppress, "jobs": cmd_jobs, "proposal": cmd_proposal, "report": cmd_report,
}


def main(argv: list | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.home = args.home.resolve()
    if args.command == "init":
        return cmd_init(args)
    try:
        settings = load_settings(home=args.home, root=HERE)
        return COMMANDS[args.command](args, settings)
    except (ConfigError, TemplateError, outreach.SendBlocked, mail.MailError) as exc:
        print(exc)
        return 1
    except smtplib.SMTPException as exc:
        print(f"The mail server refused a message: {exc}. Anything already sent is recorded.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
