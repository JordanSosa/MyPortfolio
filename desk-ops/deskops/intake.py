"""Change requests: read the template a firm sends back, check it, track the deadline.

Checks happen locally. Change requests carry directors' personal details, so
they are never sent to the AI drafter.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from . import store

FORM_484_DAYS = 28  # Form 484: "Within 28 days after the date of change"

LABELS = {
    "company name": "company name",
    "acn": "ACN",
    "date of change": "date of change (dd/mm/yyyy)",
    "role": "role (director or secretary)",
    "full name": "full name",
    "date of birth": "date of birth (dd/mm/yyyy)",
    "place of birth": "place of birth (town, state, country)",
    "residential address": "residential address",
    "director id": "director ID",
    "signed consent to act held": "confirmation that signed consent to act is held",
    "which address": "which address is changing",
    "new address": "new address",
    "occupier consent held": "confirmation that occupier consent is held (registered office)",
    "share class": "share class",
    "number of shares": "number of shares",
    "amount paid per share": "amount paid per share",
    "from": "transferor (from)",
    "to": "new holder's name and address (to)",
    "held beneficially": "whether the shares are held beneficially (yes/no)",
}

REQUIRED = {
    "appoint officeholder": ["company name", "acn", "date of change", "role", "full name", "date of birth",
                             "place of birth", "residential address", "signed consent to act held"],
    "remove officeholder": ["company name", "acn", "date of change", "role", "full name"],
    "change address": ["company name", "acn", "date of change", "which address", "new address"],
    "share issue": ["company name", "acn", "date of change", "share class", "number of shares",
                    "amount paid per share", "to", "held beneficially"],
    "share transfer": ["company name", "acn", "date of change", "share class", "number of shares",
                       "from", "to", "held beneficially"],
}


def normalise_key(key: str) -> str:
    key = re.sub(r"\(.*?\)", "", key)
    return re.sub(r"\s+", " ", key).strip(" :*-•\t").lower()


def parse_fields(text: str) -> dict:
    """'Label: value' lines from the change request template."""
    fields = {}
    for raw in text.splitlines():
        line = raw.strip().lstrip("*-•> ").strip()
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        key = normalise_key(label)
        if not key or len(key) > 40:
            continue
        value = value.strip()
        if value.lower() in {"-", "n/a", "na", "none"} and key not in {"occupier consent held", "former names"}:
            value = ""
        if not fields.get(key):
            fields[key] = value
    return fields


def looks_like_change_request(subject: str, text: str) -> bool:
    return "change request" in subject.lower() or bool(re.search(r"(?im)^\s*change type\s*:", text))


def classify(fields: dict) -> str:
    value = " ".join([fields.get("change type", ""), fields.get("issue or transfer", "")]).lower()
    if "address" in value:
        return "change address"
    if "transfer" in value:
        return "share transfer"
    if "issue" in value or "allot" in value:
        return "share issue"
    if any(word in value for word in ("remove", "resign", "cease")):
        return "remove officeholder"
    if any(word in value for word in ("appoint", "add", "new director", "new secretary")):
        return "appoint officeholder"
    return "other"


def acn_valid(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 9:
        return False
    total = sum(int(d) * w for d, w in zip(digits[:8], range(8, 0, -1)))
    return (10 - total % 10) % 10 == int(digits[8])


def director_id_valid(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    return len(digits) == 15 and digits.startswith("036")


def parse_date(value: str) -> date | None:
    value = value.strip()
    match = re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", value)
    try:
        if match:
            day, month, year = (int(x) for x in match.groups())
            return date(year, month, day)
        return date.fromisoformat(value)
    except ValueError:
        return None


def _yes(value: str) -> bool:
    return value.strip().lower() in {"yes", "y", "held", "true"}


@dataclass
class Assessment:
    change_type: str
    fields: dict
    missing: list = field(default_factory=list)
    problems: list = field(default_factory=list)
    effective: date | None = None
    asic_due: date | None = None

    @property
    def complete(self) -> bool:
        return self.change_type != "other" and not self.missing and not self.problems

    def outstanding(self) -> list:
        return [f"{LABELS.get(key, key)}" for key in self.missing] + self.problems


def assess(fields: dict) -> Assessment:
    kind = classify(fields)
    result = Assessment(kind, fields)
    if kind == "other":
        result.problems.append("a change type we can process from the template (appointment, removal, address or shares)")
        return result
    for key in REQUIRED[kind]:
        if not fields.get(key):
            result.missing.append(key)
    role = fields.get("role", "").lower()
    if kind == "appoint officeholder" and "director" in role and not fields.get("director id"):
        result.missing.append("director id")
    if kind == "change address" and "registered" in fields.get("which address", "").lower():
        consent = fields.get("occupier consent held", "").strip().lower()
        if consent not in {"yes", "n.a.", "n/a", "na", "not applicable"}:
            result.missing.append("occupier consent held")

    if fields.get("acn") and not acn_valid(fields["acn"]):
        result.problems.append(f"the ACN {fields['acn']} fails ASIC's check digit; please re-check it")
    if fields.get("director id") and not director_id_valid(fields["director id"]):
        result.problems.append("the director ID should be 15 digits starting with 036")
    if fields.get("date of change"):
        result.effective = parse_date(fields["date of change"])
        if result.effective is None:
            result.problems.append(f"the date of change ({fields['date of change']}) isn't a dd/mm/yyyy date")
        else:
            result.asic_due = result.effective + timedelta(days=FORM_484_DAYS)
    if kind == "appoint officeholder":
        if fields.get("signed consent to act held") and not _yes(fields["signed consent to act held"]):
            result.problems.append("we need signed consent to act before the appointment can be lodged")
        born = parse_date(fields.get("date of birth", "")) if fields.get("date of birth") else None
        if fields.get("date of birth") and born is None:
            result.problems.append("the date of birth isn't a dd/mm/yyyy date")
        if born and result.effective and "director" in role:
            age = result.effective.year - born.year - ((result.effective.month, result.effective.day) < (born.month, born.day))
            if age < 18:
                result.problems.append("a director must be at least 18 on the date of appointment")
    return result


def record(conn, assessment: Assessment, *, from_addr: str, subject: str) -> tuple:
    """Create or update the job for this change. Returns (job id, merged assessment)."""
    acn = re.sub(r"\D", "", assessment.fields.get("acn", ""))
    existing = None
    if acn:
        existing = conn.execute(
            "SELECT * FROM jobs WHERE acn = ? AND change_type = ? AND status != 'closed' ORDER BY id DESC LIMIT 1",
            (acn, assessment.change_type)).fetchone()
    if existing is None:
        base = re.sub(r"^(re|fw|fwd):\s*", "", subject.strip(), flags=re.IGNORECASE)
        existing = conn.execute(
            "SELECT * FROM jobs WHERE from_addr = ? AND status != 'closed' AND subject != '' AND "
            "lower(?) LIKE '%' || lower(subject) || '%' ORDER BY id DESC LIMIT 1",
            (from_addr, base)).fetchone() if base else None
    if existing is not None:
        merged = json.loads(existing["fields"])
        merged.update({k: v for k, v in assessment.fields.items() if v})
        assessment = assess(merged)
    now = store.now_iso()
    values = dict(
        company=assessment.fields.get("company name", ""),
        acn=re.sub(r"\D", "", assessment.fields.get("acn", "")),
        change_type=assessment.change_type,
        effective_date=assessment.effective.isoformat() if assessment.effective else None,
        asic_due=assessment.asic_due.isoformat() if assessment.asic_due else None,
        status="ready" if assessment.complete else "waiting on firm",
        outstanding="; ".join(assessment.outstanding()),
        fields=json.dumps(assessment.fields),
    )
    if existing is not None:
        conn.execute(
            "UPDATE jobs SET updated_at=?, company=?, acn=?, change_type=?, effective_date=?, asic_due=?, status=?, "
            "outstanding=?, fields=? WHERE id=?",
            (now, values["company"], values["acn"], values["change_type"], values["effective_date"], values["asic_due"],
             values["status"], values["outstanding"], values["fields"], existing["id"]))
        job_id = existing["id"]
    else:
        cur = conn.execute(
            "INSERT INTO jobs (created_at, updated_at, from_addr, subject, company, acn, change_type, effective_date, "
            "asic_due, status, outstanding, fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (now, now, from_addr, re.sub(r"^(re|fw|fwd):\s*", "", subject.strip(), flags=re.IGNORECASE),
             values["company"], values["acn"], values["change_type"], values["effective_date"], values["asic_due"],
             values["status"], values["outstanding"], values["fields"]))
        job_id = cur.lastrowid
    conn.commit()
    return job_id, assessment


def close(conn, job_id: int) -> bool:
    """Mark a job lodged and closed, and delete the personal details it held."""
    cur = conn.execute(
        "UPDATE jobs SET status='closed', closed_at=?, fields='{}', outstanding='' WHERE id=? AND status != 'closed'",
        (store.now_iso(), job_id))
    conn.commit()
    return cur.rowcount > 0
