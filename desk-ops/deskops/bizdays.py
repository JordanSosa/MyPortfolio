"""Business-day arithmetic for follow-ups, service levels and send windows."""

from __future__ import annotations

from datetime import date, timedelta


def is_business_day(day: date, holidays: frozenset) -> bool:
    return day.weekday() < 5 and day not in holidays


def add_business_days(start: date, count: int, holidays: frozenset) -> date:
    day, added = start, 0
    while added < count:
        day += timedelta(days=1)
        if is_business_day(day, holidays):
            added += 1
    return day


def business_days_after(start: date, end: date, holidays: frozenset) -> int:
    """Business days in the span after `start`, up to and including `end`."""
    count, day = 0, start
    while day < end:
        day += timedelta(days=1)
        if is_business_day(day, holidays):
            count += 1
    return count


def in_quiet_period(day: date, periods: tuple) -> bool:
    return any(start <= day <= end for start, end in periods)
