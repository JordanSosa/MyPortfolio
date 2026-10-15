"""One-page proposals for firms that said yes to a conversation."""

from __future__ import annotations

import html
import re
from datetime import date, timedelta
from pathlib import Path

from . import templates
from .config import Settings


def _percent(value: str) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)", value or "")
    return float(match.group(1)) / 100 if match else 0.0


def build(settings: Settings, *, firm: str, contact: str, companies: int, start: date, today: date) -> Path:
    fee = float(settings.desk_fee)
    annual = companies * fee
    monthly = annual / 12
    discount = _percent(settings.founding_discount)
    values = {key: html.escape(value) for key, value in settings.identity().items()}
    values.update(
        firm=html.escape(firm),
        contact=html.escape(contact),
        first_name=html.escape(contact.split()[0] if contact.split() else contact),
        companies=f"{companies:,}",
        fee=templates.money(fee),
        annual=templates.money(annual),
        monthly=templates.money(monthly),
        discount=html.escape(settings.founding_discount),
        founding_monthly=templates.money(monthly * (1 - discount)),
        start=f"{start:%d %B %Y}",
        today=f"{today:%d %B %Y}",
        valid_until=f"{today + timedelta(days=30):%d %B %Y}",
    )
    page = (settings.templates_dir / "proposal.html").read_text(encoding="utf-8")
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)
    leftover = re.findall(r"\{\{(\w+)\}\}", page)
    if leftover:
        raise templates.TemplateError("proposal.html uses unknown placeholder(s): " + ", ".join(sorted(set(leftover))))
    out_dir = settings.data_dir / "proposals"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", firm.lower()).strip("-") or "firm"
    path = out_dir / f"{today:%Y%m%d}-{slug}.html"
    path.write_text(page, encoding="utf-8")
    return path
