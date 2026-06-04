from datetime import datetime, timedelta, timezone


def utc_now() -> datetime:
    """Return current UTC time as timezone-aware datetime."""

    return datetime.now(timezone.utc)


def utc_after(**kwargs) -> datetime:
    return utc_now() + timedelta(**kwargs)


def as_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
