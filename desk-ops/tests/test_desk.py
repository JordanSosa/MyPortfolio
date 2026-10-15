"""Run with: python3 -m unittest discover -s tests"""

from __future__ import annotations

import email
import email.policy
import io
import json
import smtplib
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace

from support import CONFIG, DESK_OPS, FakeIMAP, FakeSMTP, email_from, make_settings

from deskops import bizdays, digest, drafter, inbox, intake, mail, outreach, proposal, store

PROSPECTS = """email,first_name,firm,suburb,website,source_url,no_objection_checked,personal_line,notes,do_not_contact
ann@firma.com.au,Ann,Firm A Accounting,Campbelltown,firma.com.au,https://firma.com.au/contact,yes,Congratulations on the new Narellan office.,,no
bob@firmb.com.au,Bob,Firm B Partners,Camden,firmb.com.au,https://firmb.com.au/team,yes,,,no
carol@firmc.com.au,Carol,Firm C,Narellan,firmc.com.au,https://firmc.com.au/contact,yes,,,no
dan@firmd.com.au,,Firm D,Picton,firmd.com.au,https://firmd.com.au/,yes,,,no
erin@employer-client.com.au,Erin,Employer's Client,Ingleburn,employer-client.com.au,https://employer-client.com.au,yes,,,yes
"""

APPOINT = """Hi team,

Change type: Appoint officeholder
Company name: Harbour Holdings Pty Ltd
ACN: 004 085 616
Date of change (dd/mm/yyyy): 02/11/2026
Your firm and contact: Firm A Accounting, Ann

Role (director / secretary): Director
Full name: Sam Example
Date of birth (dd/mm/yyyy): {dob}
Place of birth (town, state, country): Sydney, NSW, Australia
Residential address: 1 Example Street, Campbelltown NSW 2560
Director ID (15 digits, starts 036): {director_id}
Signed consent to act held (yes/no): yes
"""

BOUNCE = b"""From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>
To: desk@example.org
Subject: Delivery Status Notification (Failure)
Message-ID: <bounce-1@mail.example>
Date: Mon, 09 Nov 2026 09:00:00 +1100
MIME-Version: 1.0
Content-Type: multipart/report; report-type=delivery-status; boundary="b1"

--b1
Content-Type: text/plain; charset=utf-8

Your message wasn't delivered to carol@firmc.com.au because the address couldn't be found.

--b1
Content-Type: message/delivery-status

Reporting-MTA: dns; googlemail.com

Final-Recipient: rfc822; carol@firmc.com.au
Action: failed
Status: 5.1.1

--b1--
"""


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.settings = make_settings(self.home, prospects=PROSPECTS)
        self.conn = store.connect(self.settings.db_path)
        rows = outreach.read_prospects(self.settings.prospects_csv)
        outreach.import_prospects(self.conn, rows)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def record_sent(self, addr, step, day, subject="ASIC work off your plate, $140 per company a year"):
        message_id = f"<{addr.replace('@', '.')}-{step}@example.org>"
        self.conn.execute(
            "INSERT INTO messages (email, step, message_id, subject, sent_at) VALUES (?, ?, ?, ?, ?)",
            (addr, step, message_id, subject, f"{day.isoformat()}T09:00:00"))
        self.conn.commit()
        return message_id


class BusinessDays(unittest.TestCase):
    def test_skips_weekends_and_holidays(self):
        holidays = frozenset({date(2026, 12, 25), date(2026, 12, 28)})
        self.assertEqual(bizdays.add_business_days(date(2026, 12, 24), 1, holidays), date(2026, 12, 29))
        self.assertEqual(bizdays.business_days_after(date(2026, 11, 2), date(2026, 11, 6), frozenset()), 4)
        self.assertEqual(bizdays.business_days_after(date(2026, 11, 6), date(2026, 11, 9), frozenset()), 1)
        self.assertTrue(bizdays.in_quiet_period(date(2027, 1, 4), ((date(2026, 12, 19), date(2027, 1, 10)),)))


class ChangeRequests(unittest.TestCase):
    def test_identifier_checks(self):
        self.assertTrue(intake.acn_valid("004 085 616"))
        self.assertTrue(intake.acn_valid("000000019"))
        self.assertFalse(intake.acn_valid("004 085 617"))
        self.assertFalse(intake.acn_valid("12345"))
        self.assertTrue(intake.director_id_valid("036 123 456 789 012"))
        self.assertFalse(intake.director_id_valid("136123456789012"))

    def test_complete_request_sets_the_asic_deadline(self):
        result = intake.assess(intake.parse_fields(APPOINT.format(dob="14/03/1985", director_id="036 123 456 789 012")))
        self.assertEqual(result.change_type, "appoint officeholder")
        self.assertTrue(result.complete, result.outstanding())
        self.assertEqual(result.asic_due, date(2026, 11, 30))

    def test_missing_and_invalid_details_are_listed(self):
        text = APPOINT.format(dob="", director_id="12345").replace("004 085 616", "004 085 617")
        result = intake.assess(intake.parse_fields(text))
        outstanding = " | ".join(result.outstanding())
        self.assertIn("date of birth", outstanding)
        self.assertIn("check digit", outstanding)
        self.assertIn("15 digits starting with 036", outstanding)
        self.assertFalse(result.complete)

    def test_underage_director_is_flagged(self):
        result = intake.assess(intake.parse_fields(APPOINT.format(dob="01/01/2010", director_id="036123456789012")))
        self.assertIn("at least 18", " ".join(result.problems))

    def test_registered_office_needs_occupier_consent(self):
        text = ("Change type: change address\nCompany name: Harbour Holdings Pty Ltd\nACN: 004085616\n"
                "Date of change: 01/11/2026\nWhich address: registered office\nNew address: 5 Queen Street, Camden")
        result = intake.assess(intake.parse_fields(text))
        self.assertIn("occupier consent held", result.missing)

    def test_follow_up_email_completes_the_job(self):
        with tempfile.TemporaryDirectory() as tmp:
            conn = store.connect(Path(tmp) / "desk.db")
            first = intake.assess(intake.parse_fields(APPOINT.format(dob="", director_id="036123456789012")))
            job_id, merged = intake.record(conn, first, from_addr="ann@firma.com.au",
                                           subject="Change request: Harbour Holdings")
            self.assertFalse(merged.complete)
            second = intake.assess(intake.parse_fields(
                "Change type: appoint officeholder\nACN: 004 085 616\nDate of birth: 14/03/1985"))
            job_id2, merged2 = intake.record(conn, second, from_addr="ann@firma.com.au",
                                             subject="Re: Change request: Harbour Holdings")
            self.assertEqual(job_id, job_id2)
            self.assertTrue(merged2.complete, merged2.outstanding())
            self.assertTrue(intake.close(conn, job_id))
            row = conn.execute("SELECT status, fields FROM jobs WHERE id = ?", (job_id,)).fetchone()
            self.assertEqual((row["status"], json.loads(row["fields"])), ("closed", {}))
            conn.close()


class ProspectList(Base):
    def test_validation_catches_what_the_spam_act_cares_about(self):
        rows = outreach.read_prospects(self.settings.prospects_csv)
        rows.append(dict(rows[0], _line=7))  # duplicate
        rows.append(dict(rows[1], email="zoe@firmz.com.au", source_url="", _line=8))
        rows.append(dict(rows[1], email="yan@firmy.com.au", no_objection_checked="", _line=9))
        rows.append(dict(rows[1], email="not-an-email", _line=10))
        rows.append(dict(rows[1], email="kim@gmail.com", website="firmk.com.au", _line=11))
        rows.append(dict(rows[1], email="lee@otherdomain.com.au", website="firml.com.au", _line=12))
        errors, warnings = outreach.validate(rows)
        text = "\n".join(str(e) for e in errors)
        self.assertIn("duplicate", text)
        self.assertIn("source_url", text)
        self.assertIn("no_objection_checked", text)
        self.assertIn("doesn't look valid", text)
        self.assertNotIn("employer-client", text)  # do_not_contact rows are skipped
        warning_text = "\n".join(str(w) for w in warnings)
        self.assertIn("otherdomain.com.au doesn't match", warning_text)
        self.assertNotIn("gmail.com doesn't match", warning_text)
        self.assertIn("no first_name", warning_text)

    def test_do_not_contact_rows_are_excluded(self):
        row = self.conn.execute("SELECT status FROM prospects WHERE email = 'erin@employer-client.com.au'").fetchone()
        self.assertEqual(row["status"], "excluded")


class Sequencing(Base):
    def test_first_emails_then_one_follow_up_after_four_business_days(self):
        monday = date(2026, 11, 2)
        first = {item.prospect["email"]: item.step for item in outreach.due(self.conn, self.settings, monday)}
        self.assertEqual(first, {"ann@firma.com.au": 1, "bob@firmb.com.au": 1, "carol@firmc.com.au": 1, "dan@firmd.com.au": 1})

        for addr in first:
            self.record_sent(addr, 1, monday)
        self.assertEqual(outreach.due(self.conn, self.settings, date(2026, 11, 5)), [])
        due = outreach.due(self.conn, self.settings, date(2026, 11, 6))
        self.assertEqual({(i.prospect["email"], i.step) for i in due}, {(a, 2) for a in first})

        store.set_status(self.conn, "bob@firmb.com.au", "replied")
        store.suppress(self.conn, "carol@firmc.com.au", "bounced")
        due = {i.prospect["email"] for i in outreach.due(self.conn, self.settings, date(2026, 11, 6))}
        self.assertEqual(due, {"ann@firma.com.au", "dan@firmd.com.au"})

        self.record_sent("ann@firma.com.au", 2, date(2026, 11, 6))
        later = {i.prospect["email"] for i in outreach.due(self.conn, self.settings, date(2026, 11, 20))}
        self.assertEqual(later, {"dan@firmd.com.au"})  # Ann has had both emails

    def test_daily_limit_counts_what_already_went_today(self):
        settings = make_settings(self.home, CONFIG.replace("daily_limit = 15", "daily_limit = 3"))
        today = date(2026, 11, 2)
        self.record_sent("ann@firma.com.au", 1, today)
        self.assertEqual(len(outreach.due(self.conn, settings, today)), 2)

    def test_compose_identifies_the_sender_and_offers_unsubscribe(self):
        prospect = dict(self.conn.execute("SELECT * FROM prospects WHERE email = 'ann@firma.com.au'").fetchone())
        message = outreach.compose(self.settings, outreach.Due(prospect, 1, None))
        body = message.get_content()
        self.assertEqual(str(message["Subject"]), "ASIC work off your plate, $140 per company a year")
        self.assertTrue(body.startswith("Hi Ann,\n\nCongratulations on the new Narellan office.\n\nI run Example Corp-Sec Desk"))
        self.assertIn("ABN 12 345 678 901", body)
        self.assertIn('Reply "unsubscribe"', body)
        self.assertIn("mailto:desk@example.org?subject=unsubscribe", str(message["List-Unsubscribe"]))
        self.assertNotIn("{", body)

        first = {"subject": str(message["Subject"]), "message_id": message["Message-ID"]}
        follow = outreach.compose(self.settings, outreach.Due(prospect, 2, first))
        self.assertEqual(str(follow["Subject"]), "Re: ASIC work off your plate, $140 per company a year")
        self.assertEqual(follow["In-Reply-To"], message["Message-ID"])
        self.assertIn("at Firm A Accounting", follow.get_content())

    def test_preview_sends_nothing_and_live_records_each_send(self):
        now = datetime(2026, 11, 2, 9, 0)
        out = io.StringIO()
        with redirect_stdout(out):
            previews = outreach.send(self.conn, self.settings, live=False, now=now)
        self.assertEqual(len(previews), 4)
        self.assertEqual(len(list((self.settings.data_dir / "preview").glob("*.eml"))), 4)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 0)

        smtp, saved = FakeSMTP(), []
        with redirect_stdout(io.StringIO()):
            outreach.send(self.conn, self.settings, live=True, now=now, smtp_factory=lambda s: smtp,
                          on_sent=saved.append, sleep=lambda s: None)
        self.assertEqual(len(smtp.sent), 4)
        self.assertTrue(smtp.closed)
        self.assertEqual(len(saved), 4)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 4)
        self.assertEqual(outreach.due(self.conn, self.settings, now.date()), [])

    def test_a_refused_address_is_marked_and_the_batch_continues(self):
        class Refusing(FakeSMTP):
            def send_message(self, message):
                if "bob@" in str(message["To"]):
                    raise smtplib.SMTPRecipientsRefused({"bob@firmb.com.au": (550, b"no such user")})
                super().send_message(message)

        smtp, out = Refusing(), io.StringIO()
        with redirect_stdout(out):
            outreach.send(self.conn, self.settings, live=True, now=datetime(2026, 11, 2, 9),
                          smtp_factory=lambda s: smtp, sleep=lambda s: None)
        self.assertEqual(len(smtp.sent), 3)
        self.assertIn("Sent 3 email(s).", out.getvalue())
        self.assertTrue(store.is_suppressed(self.conn, "bob@firmb.com.au"))

    def test_clearing_do_not_contact_reactivates_unless_suppressed(self):
        rows = outreach.read_prospects(self.settings.prospects_csv)
        for row in rows:
            row["do_not_contact"] = "no"
        outreach.import_prospects(self.conn, rows)
        row = self.conn.execute("SELECT status FROM prospects WHERE email = 'erin@employer-client.com.au'").fetchone()
        self.assertEqual(row["status"], "active")
        store.suppress(self.conn, "erin@employer-client.com.au", "manual")
        store.set_status(self.conn, "erin@employer-client.com.au", "excluded")
        outreach.import_prospects(self.conn, rows)
        row = self.conn.execute("SELECT status FROM prospects WHERE email = 'erin@employer-client.com.au'").fetchone()
        self.assertEqual(row["status"], "excluded")

    def test_live_sending_refuses_placeholder_sender_details(self):
        settings = make_settings(self.home, CONFIG.replace("abn = 12 345 678 901", "abn = [ABN]"))
        with self.assertRaises(outreach.SendBlocked):
            outreach.send(self.conn, settings, live=True, now=datetime(2026, 11, 2, 9), smtp_factory=lambda s: FakeSMTP())

    def test_send_window(self):
        self.assertIsNone(outreach.window_problem(self.settings, datetime(2026, 11, 2, 9, 0)))
        self.assertIn("window", outreach.window_problem(self.settings, datetime(2026, 11, 2, 18, 0)))
        self.assertIn("business day", outreach.window_problem(self.settings, datetime(2026, 11, 7, 9, 0)))
        self.assertIn("business day", outreach.window_problem(self.settings, datetime(2026, 12, 25, 9, 0)))
        self.assertIn("quiet", outreach.window_problem(self.settings, datetime(2027, 1, 5, 9, 0)))


class Inbox(Base):
    def setUp(self):
        super().setUp()
        monday = date(2026, 11, 2)
        self.ids = {a: self.record_sent(a, 1, monday) for a in
                    ("ann@firma.com.au", "bob@firmb.com.au", "carol@firmc.com.au", "dan@firmd.com.au")}

    def build_inbox(self):
        reply = email_from("Ann Citizen <ann@firma.com.au>", "Re: ASIC work off your plate",
                           "Hi Jordan,\n\nInteresting. What does the transfer of agent involve?\n\nOn Mon wrote:\n> old text",
                           headers={"In-Reply-To": self.ids["ann@firma.com.au"]})
        colleague = email_from("Practice Manager <office@firmd.com.au>", "Re: ASIC work off your plate",
                               "Please unsubscribe us.\n", headers={"In-Reply-To": self.ids["dan@firmd.com.au"]})
        declined = email_from("Bob <bob@firmb.com.au>", "Re: ASIC work off your plate",
                              "Thanks, but we handle this in-house.\n")
        auto = email_from("Ann Citizen <ann@firma.com.au>", "Automatic reply: ASIC work off your plate",
                          "I'm out of the office until Monday.", headers={"Auto-Submitted": "auto-replied"})
        change = email_from("Pat Client <pat@clientfirm.com.au>", "Change request: Harbour Holdings",
                            APPOINT.format(dob="", director_id="036123456789012"))
        newsletter = email_from("Software News <news@vendor.example>", "Your monthly update", "Big news!",
                                headers={"List-Unsubscribe": "<mailto:unsub@vendor.example>"})
        enquiry = email_from("Quinn Smith <quinn@newfirm.com.au>", "Do you handle SMSF trustee companies?",
                             "We have about 40 SMSF corporate trustees. Can you take those on?")
        bounce = email.message_from_bytes(BOUNCE, policy=email.policy.default)
        return FakeIMAP([reply, colleague, declined, auto, change, newsletter, enquiry, bounce])

    def test_each_message_gets_one_outcome_and_drafts_wait_for_review(self):
        imap = self.build_inbox()
        summary = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9))
        self.assertEqual(summary.outcomes, {
            "prospect reply": 1, "unsubscribe": 1, "decline": 1, "auto-reply": 1,
            "change request": 1, "bulk": 1, "enquiry": 1, "bounce": 1,
        })
        status = {r["email"]: r["status"] for r in self.conn.execute("SELECT email, status FROM prospects")}
        self.assertEqual(status["ann@firma.com.au"], "replied")
        self.assertEqual(status["dan@firmd.com.au"], "unsubscribed")
        self.assertEqual(status["bob@firmb.com.au"], "declined")
        self.assertEqual(status["carol@firmc.com.au"], "bounced")
        for addr in ("dan@firmd.com.au", "office@firmd.com.au", "bob@firmb.com.au", "carol@firmc.com.au"):
            self.assertTrue(store.is_suppressed(self.conn, addr), addr)

        drafts = [email.message_from_bytes(raw, policy=email.policy.default) for raw in imap.folders["[Gmail]/Drafts"]]
        self.assertEqual(summary.drafts, 3)
        self.assertEqual(sorted(str(d["To"]) for d in drafts),
                         ["Ann Citizen <ann@firma.com.au>", "Pat Client <pat@clientfirm.com.au>",
                          "Quinn Smith <quinn@newfirm.com.au>"])
        change_draft = next(d for d in drafts if "pat@" in str(d["To"]))
        self.assertEqual(str(change_draft["Subject"]), "Re: Change request: Harbour Holdings")
        self.assertIn("date of birth", change_draft.get_content())
        ann_draft = next(d for d in drafts if "ann@" in str(d["To"]))
        self.assertTrue(ann_draft.get_content().startswith("Hi Ann,"))
        self.assertIn("https://cal.example.org/desk", ann_draft.get_content())

        job = self.conn.execute("SELECT * FROM jobs").fetchone()
        self.assertEqual((job["status"], job["asic_due"]), ("waiting on firm", "2026-11-30"))

        full_fetches = imap.full_fetches
        again = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9))
        self.assertEqual((again.seen, again.drafts), (0, 0))
        self.assertEqual(len(imap.folders["[Gmail]/Drafts"]), 3)
        self.assertEqual(imap.full_fetches, full_fetches)  # second run reads headers only

    def test_opt_outs_are_read_carefully(self):
        quoted_footer = email_from(
            "Ann Citizen <ann@firma.com.au>", "Re: ASIC work off your plate",
            "Yes, keen to chat.\n\nFollowing up on my note last week.\n--\nJordan Example | Example Corp-Sec Desk\n"
            'Not relevant to you? Reply "unsubscribe" and I won\'t email you again.\n',
            headers={"In-Reply-To": self.ids["ann@firma.com.au"]})
        busy = email_from("Bob <bob@firmb.com.au>", "Re: ASIC work off your plate",
                          "We're fine for Tuesday at 10. Talk then.")
        refusal = email_from("Carol <carol@firmc.com.au>", "Re: ASIC work off your plate", "Not interested, thanks.")
        stranger = email_from("Someone <someone@elsewhere.com.au>", "Your email", "Please remove me from your list.")
        imap = FakeIMAP([quoted_footer, busy, refusal, stranger])
        summary = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9))
        self.assertEqual(summary.outcomes, {"prospect reply": 2, "decline": 1, "unsubscribe": 1})
        status = {r["email"]: r["status"] for r in self.conn.execute("SELECT email, status FROM prospects")}
        self.assertEqual((status["ann@firma.com.au"], status["bob@firmb.com.au"], status["carol@firmc.com.au"]),
                         ("replied", "replied", "declined"))
        self.assertTrue(store.is_suppressed(self.conn, "someone@elsewhere.com.au"))
        self.assertFalse(store.is_suppressed(self.conn, "ann@firma.com.au"))
        # Suppressions are stamped with the real clock, so read the digest as of today.
        self.assertIn("carol@firmc.com.au (declined)", digest.build(self.conn, self.settings, date.today()))

    def test_client_mail_never_goes_to_the_ai(self):
        calls = []
        fake = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(
            create=lambda **kw: calls.append(kw) or SimpleNamespace(
                stop_reason="end_turn", content=[SimpleNamespace(type="text", text="Hi Ann, AI draft.")]))))
        store.set_status(self.conn, "ann@firma.com.au", "client")
        question = email_from("Ann Citizen <ann@firma.com.au>", "Quick question",
                              "Can you add Sam as a director? DOB 14/03/1985.")
        imap = FakeIMAP([question])
        summary = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9),
                                drafter=drafter.Drafter(self.settings, client=fake))
        self.assertEqual(summary.outcomes, {"client email": 1})
        self.assertEqual(calls, [])

    def test_ai_drafts_prospect_replies_with_redacted_text(self):
        calls = []

        def create(**kwargs):
            calls.append(kwargs)
            return SimpleNamespace(stop_reason="end_turn",
                                   content=[SimpleNamespace(type="thinking", thinking=""),
                                            SimpleNamespace(type="text", text="Hi Ann,\n\nGreat question.\n\nJordan Example")])

        fake = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
        reply = email_from("Ann Citizen <ann@firma.com.au>", "Re: ASIC work off your plate",
                           "Call me on 0412 345 678 or email ann.private@gmail.com. Our ACN is 004 085 616.",
                           headers={"In-Reply-To": self.ids["ann@firma.com.au"]})
        imap = FakeIMAP([reply])
        summary = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9),
                                drafter=drafter.Drafter(self.settings, client=fake))
        self.assertEqual((summary.drafts, summary.ai_drafts), (1, 1))
        sent = calls[0]
        self.assertEqual(sent["model"], "claude-opus-5-5")
        self.assertEqual(sent["betas"], ["server-side-fallback-2026-07-01"])
        self.assertEqual(sent["fallbacks"], "default")
        self.assertEqual(sent["output_config"], {"effort": "low"})
        user_text = sent["messages"][0]["content"]
        for secret in ("0412 345 678", "ann.private@gmail.com", "004 085 616"):
            self.assertNotIn(secret, user_text)
        self.assertIn("$140 per company per year", sent["system"])
        draft = email.message_from_bytes(imap.folders["[Gmail]/Drafts"][0], policy=email.policy.default)
        self.assertIn("Great question.", draft.get_content())

    def test_refusals_and_errors_fall_back_to_templates(self):
        fake = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(
            create=lambda **kw: SimpleNamespace(stop_reason="refusal", content=[]))))
        enquiry = email_from("Quinn <quinn@newfirm.com.au>", "Question", "Do you do trusts?")
        imap = FakeIMAP([enquiry])
        summary = inbox.process(self.conn, self.settings, imap, today=date(2026, 11, 9),
                                drafter=drafter.Drafter(self.settings, client=fake))
        self.assertEqual((summary.drafts, summary.ai_drafts), (1, 0))
        self.assertIn("declined", " ".join(summary.notes))
        draft = email.message_from_bytes(imap.folders["[Gmail]/Drafts"][0], policy=email.policy.default)
        self.assertIn("[Write the answer here.]", draft.get_content())


class Redaction(unittest.TestCase):
    def test_personal_details_are_replaced(self):
        text = ("Email jane.doe@example.com or call +61 412 345 678 / (02) 4600 1234. Born 14/03/1985. "
                "Director ID 036 123 456 789 012, ACN 004 085 616. Lives at 12 Smith Street, Camden. Fee $140.")
        out = drafter.redact(text)
        for secret in ("jane.doe", "412 345 678", "14/03/1985", "036 123", "004 085 616", "12 Smith Street"):
            self.assertNotIn(secret, out)
        self.assertIn("$140", out)


class Reporting(Base):
    def test_digest_flags_overdue_changes_with_the_late_fee(self):
        result = intake.assess(intake.parse_fields(APPOINT.format(dob="14/03/1985", director_id="036123456789012")))
        intake.record(self.conn, result, from_addr="ann@firma.com.au", subject="Change request: Harbour")
        text = digest.build(self.conn, self.settings, date(2026, 12, 3))
        self.assertIn("OVERDUE by 3 day(s), ASIC late fee about $102", text)
        self.assertIn("Due today: 4 first email(s), 0 follow-up(s)", text)

    def test_proposal_prices_the_book(self):
        path = proposal.build(self.settings, firm="Firm A & Co", contact="Ann Citizen", companies=85,
                              start=date(2027, 2, 1), today=date(2026, 12, 1))
        page = path.read_text(encoding="utf-8")
        for expected in ("Firm A &amp; Co", "$11,900", "$991.67", "$842.92", "01 February 2027", "31 December 2026",
                         "share issue or transfer $95"):
            self.assertIn(expected, page)
        self.assertNotIn("{{", page)


class SiteTemplate(unittest.TestCase):
    def test_the_sites_change_template_round_trips_through_the_parser(self):
        import re
        from urllib.parse import unquote

        page = DESK_OPS.parent / "corp-sec-desk" / "index.html"
        if not page.exists():
            self.skipTest("corp-sec-desk site not alongside desk-ops")
        href = re.search(r'href="(mailto:\[email\]\?subject=Change[^"]+)"', page.read_text(encoding="utf-8")).group(1)
        subject = unquote(re.search(r"subject=([^&]+)", href).group(1))
        body = unquote(re.search(r"body=(.+)$", href).group(1))
        shipped = (DESK_OPS / "templates" / "change_request.txt").read_text(encoding="utf-8")
        self.assertEqual(body.replace("\r\n", "\n").strip(), shipped.partition("\n")[2].strip())
        filled = (body.replace("share transfer):", "share transfer): appoint officeholder")
                  .replace("Company name:", "Company name: Harbour Holdings Pty Ltd")
                  .replace("ACN:", "ACN: 004 085 616")
                  .replace("Date of change (dd/mm/yyyy):", "Date of change (dd/mm/yyyy): 02/11/2026")
                  .replace("Role (director / secretary):", "Role (director / secretary): director")
                  .replace("Full name:", "Full name: Sam Example")
                  .replace("Date of birth (dd/mm/yyyy):", "Date of birth (dd/mm/yyyy): 14/03/1985")
                  .replace("Place of birth (town, state, country):", "Place of birth (town, state, country): Sydney NSW Australia")
                  .replace("Residential address:", "Residential address: 1 Example Street, Campbelltown")
                  .replace("Director ID (15 digits, starts 036):", "Director ID (15 digits, starts 036): 036123456789012")
                  .replace("Signed consent to act held (yes/no):", "Signed consent to act held (yes/no): yes"))
        self.assertTrue(intake.looks_like_change_request(subject, filled))
        result = intake.assess(intake.parse_fields(mail.new_text(filled)))
        self.assertTrue(result.complete, result.outstanding())


class CommandLine(unittest.TestCase):
    def test_check_and_preview_from_a_fresh_folder(self):
        import desk  # the CLI module at desk-ops/desk.py

        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(desk.main(["--home", tmp, "init"]), 0)
                self.assertEqual(desk.main(["--home", tmp, "check", "--no-login"]), 1)  # placeholders remain
            self.assertIn("Still to fill in [sender]", out.getvalue())

            (home / "config.ini").write_text(CONFIG, encoding="utf-8")
            (home / "prospects.csv").write_text(PROSPECTS, encoding="utf-8")
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(desk.main(["--home", tmp, "check", "--no-login"]), 0)
                self.assertEqual(desk.main(["--home", tmp, "send"]), 0)
                self.assertEqual(desk.main(["--home", tmp, "jobs"]), 0)
                self.assertEqual(desk.main(["--home", tmp, "report"]), 0)
            text = out.getvalue()
            self.assertIn("Prospects: 5 row(s) in prospects.csv.", text)
            self.assertIn("Pipeline: 4 active of 6.", text)  # the example row from init stays, excluded
            self.assertIn("Previewed 4 email(s)", text)
            self.assertTrue((home / "data" / "pipeline.csv").exists())


if __name__ == "__main__":
    unittest.main()
