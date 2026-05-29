from datetime import datetime, timedelta, timezone


def utc_now() -> datetime:
    """Return current UTC time as naive datetime for SQLite storage."""

    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_after(**kwargs) -> datetime:
    return utc_now() + timedelta(**kwargs)


def as_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def utc_now_aware() -> datetime:
    return datetime.now(timezone.utc)
