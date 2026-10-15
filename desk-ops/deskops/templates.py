"""Plain-text email templates: an optional 'Subject:' first line, then the body."""

from __future__ import annotations

import re
from string import Formatter

from .config import Settings


class TemplateError(Exception):
    """A template uses a placeholder the desk doesn't supply."""


def load(settings: Settings, name: str) -> tuple:
    path = settings.templates_dir / name
    text = path.read_text(encoding="utf-8")
    first, _, rest = text.partition("\n")
    if first.lower().startswith("subject:"):
        return first.split(":", 1)[1].strip(), rest.lstrip("\n")
    return "", text


def fill(text: str, values: dict) -> str:
    """Fill {placeholders}, failing loudly on any the caller didn't supply."""
    fields = {field for _, field, _, _ in Formatter().parse(text) if field}
    missing = sorted(fields - set(values))
    if missing:
        raise TemplateError("unknown placeholder(s): " + ", ".join("{" + m + "}" for m in missing))
    filled = text.format_map(values)
    return re.sub(r"\n{3,}", "\n\n", filled).strip()


def greeting(first_name: str) -> str:
    first_name = (first_name or "").strip()
    return f"Hi {first_name}," if first_name else "Hello,"


def paragraph(line: str) -> str:
    """An optional paragraph: empty, or the line followed by a blank line."""
    line = (line or "").strip()
    return f"{line}\n\n" if line else ""


def money(amount: float) -> str:
    return f"${amount:,.0f}" if float(amount).is_integer() else f"${amount:,.2f}"
