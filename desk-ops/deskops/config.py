"""Settings: config.ini holds the desk's details, the environment holds secrets."""

from __future__ import annotations

import configparser
import os
import re
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PASSWORD_ENV = "DESK_MAIL_PASSWORD"


class ConfigError(Exception):
    """config.ini is missing or has a value the desk can't use."""


@dataclass(frozen=True)
class Settings:
    sender_name: str
    business: str
    abn: str
    desk_email: str
    phone: str
    location: str
    agent_number: str
    booking_link: str
    desk_fee: str
    founding_discount: str
    share_change_fee: str
    special_resolution_fee: str
    new_company_fee: str
    deregistration_fee: str
    mail_username: str
    mail_password: str
    smtp_host: str
    smtp_port: int
    imap_host: str
    imap_port: int
    inbox_folder: str
    drafts_folder: str
    sent_folder: str
    daily_limit: int
    followup_after_days: int
    max_touches: int
    min_delay: float
    max_delay: float
    window_start: time
    window_end: time
    holidays: frozenset
    quiet_periods: tuple
    ai_enabled: bool
    ai_model: str
    ai_effort: str
    root: Path = ROOT  # templates and knowledge base ship here
    home: Path = ROOT  # config.ini, prospects.csv and data/ live here

    @property
    def data_dir(self) -> Path:
        return self.home / "data"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "desk.db"

    @property
    def prospects_csv(self) -> Path:
        return self.home / "prospects.csv"

    @property
    def templates_dir(self) -> Path:
        return self.root / "templates"

    @property
    def knowledge_path(self) -> Path:
        return self.root / "knowledge" / "faq.md"

    def identity(self) -> dict:
        """Values every template and the knowledge base can use."""
        return {
            "sender_name": self.sender_name,
            "business": self.business,
            "abn": self.abn,
            "desk_email": self.desk_email,
            "phone": self.phone,
            "location": self.location,
            "agent_number": self.agent_number,
            "booking_link": self.booking_link,
            "desk_fee": self.desk_fee,
            "founding_discount": self.founding_discount,
            "share_change_fee": self.share_change_fee,
            "special_resolution_fee": self.special_resolution_fee,
            "new_company_fee": self.new_company_fee,
            "deregistration_fee": self.deregistration_fee,
        }

    def unfilled_identity(self) -> list:
        """Sender details still holding a [placeholder].

        The Spam Act requires accurate sender details, so live sending refuses
        to run while any of these remain.
        """
        required = ("sender_name", "business", "abn", "desk_email", "phone", "booking_link")
        values = self.identity()
        return [key for key in required if not values[key] or "[" in values[key]]


def _amount(value: str, key: str) -> str:
    cleaned = value.strip().lstrip("$").replace(",", "")
    try:
        number = float(cleaned)
    except ValueError as exc:
        raise ConfigError(f"[offer] {key} should be a dollar amount like 140, not {value!r}") from exc
    if number <= 0:
        raise ConfigError(f"[offer] {key} must be more than 0")
    return f"{number:g}"


def _parse_window(value: str) -> tuple:
    match = re.fullmatch(r"\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*", value)
    if not match:
        raise ConfigError(f"send_window should look like 08:30-15:30, not {value!r}")
    h1, m1, h2, m2 = (int(x) for x in match.groups())
    try:
        start, end = time(h1, m1), time(h2, m2)
    except ValueError as exc:
        raise ConfigError(f"send_window has an impossible time: {value!r}") from exc
    if start >= end:
        raise ConfigError("send_window must start before it ends")
    return start, end


def _parse_dates(value: str) -> frozenset:
    days = set()
    for token in re.split(r"[\s,]+", value.strip()):
        if not token:
            continue
        try:
            days.add(date.fromisoformat(token))
        except ValueError as exc:
            raise ConfigError(f"holidays: {token!r} isn't a YYYY-MM-DD date") from exc
    return frozenset(days)


def _parse_periods(value: str) -> tuple:
    periods = []
    for token in re.split(r"[\s,]+", value.strip()):
        if not token:
            continue
        start, sep, end = token.partition("..")
        try:
            if not sep:
                raise ValueError
            periods.append((date.fromisoformat(start), date.fromisoformat(end)))
        except ValueError as exc:
            raise ConfigError(f"quiet_periods: {token!r} should look like 2026-12-19..2027-01-10") from exc
    return tuple(periods)


def load_settings(home: Path | None = None, root: Path | None = None) -> Settings:
    root = root or ROOT
    home = home or root
    path = home / "config.ini"
    if not path.exists():
        raise ConfigError(f"{path} not found. Run: python3 desk.py init")
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(path, encoding="utf-8")

    def get(section: str, key: str, default: str | None = None) -> str:
        if parser.has_option(section, key):
            return parser.get(section, key).strip()
        if default is None:
            raise ConfigError(f"config.ini is missing [{section}] {key}")
        return default

    def get_int(section: str, key: str, default: int) -> int:
        raw = get(section, key, str(default))
        try:
            return int(raw)
        except ValueError as exc:
            raise ConfigError(f"[{section}] {key} should be a whole number, not {raw!r}") from exc

    def get_float(section: str, key: str, default: float) -> float:
        raw = get(section, key, str(default))
        try:
            return float(raw)
        except ValueError as exc:
            raise ConfigError(f"[{section}] {key} should be a number, not {raw!r}") from exc

    window_start, window_end = _parse_window(get("outreach", "send_window", "08:30-15:30"))
    min_delay = get_float("outreach", "min_delay_seconds", 45)
    max_delay = get_float("outreach", "max_delay_seconds", 120)
    if min_delay < 0 or max_delay < min_delay:
        raise ConfigError("min_delay_seconds must be 0 or more and no larger than max_delay_seconds")
    effort = get("ai", "effort", "low").lower()
    if effort not in {"low", "medium", "high", "xhigh", "max"}:
        raise ConfigError("[ai] effort should be low, medium, high, xhigh or max")

    settings = Settings(
        sender_name=get("sender", "name"),
        business=get("sender", "business"),
        abn=get("sender", "abn"),
        desk_email=get("sender", "email"),
        phone=get("sender", "phone"),
        location=get("sender", "location", "Macarthur, NSW"),
        agent_number=get("sender", "agent_number", ""),
        booking_link=get("sender", "booking_link"),
        desk_fee=_amount(get("offer", "desk_fee"), "desk_fee"),
        founding_discount=get("offer", "founding_discount", "15%"),
        share_change_fee=_amount(get("offer", "share_change_fee", "95"), "share_change_fee"),
        special_resolution_fee=_amount(get("offer", "special_resolution_fee", "150"), "special_resolution_fee"),
        new_company_fee=_amount(get("offer", "new_company_fee", "220"), "new_company_fee"),
        deregistration_fee=_amount(get("offer", "deregistration_fee", "140"), "deregistration_fee"),
        mail_username=get("mail", "username"),
        mail_password=os.environ.get(PASSWORD_ENV) or get("mail", "password", ""),
        smtp_host=get("mail", "smtp_host"),
        smtp_port=get_int("mail", "smtp_port", 587),
        imap_host=get("mail", "imap_host"),
        imap_port=get_int("mail", "imap_port", 993),
        inbox_folder=get("mail", "inbox_folder", "INBOX"),
        drafts_folder=get("mail", "drafts_folder", "Drafts"),
        sent_folder=get("mail", "sent_folder", ""),
        daily_limit=get_int("outreach", "daily_limit", 15),
        followup_after_days=get_int("outreach", "followup_after_business_days", 4),
        max_touches=get_int("outreach", "max_emails_per_firm", 2),
        min_delay=min_delay,
        max_delay=max_delay,
        window_start=window_start,
        window_end=window_end,
        holidays=_parse_dates(get("outreach", "holidays", "")),
        quiet_periods=_parse_periods(get("outreach", "quiet_periods", "")),
        ai_enabled=get("ai", "enabled", "false").lower() in {"1", "true", "yes", "on"},
        ai_model=get("ai", "model", "claude-opus-5-5"),
        ai_effort=effort,
        root=root,
        home=home,
    )
    if settings.daily_limit < 1 or settings.max_touches < 1 or settings.followup_after_days < 1:
        raise ConfigError("daily_limit, max_emails_per_firm and followup_after_business_days must be at least 1")
    return settings
