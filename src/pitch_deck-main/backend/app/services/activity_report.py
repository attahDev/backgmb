"""Best-effort reporting of user activity back to the main backend, so
the admin portal's Overview page has something to show for Pitch Deck
Builder usage. Never allowed to break the caller: any failure here is
logged and swallowed, since a missed activity-log entry is a much
smaller problem than a failed deck build.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def report_activity_sync(user_id: str | None, activity_type: str, message: str, metadata: dict | None = None) -> None:
    """Synchronous version — deck_worker.py runs on a plain (non-async)
    thread/process, not inside an event loop, so this uses a blocking
    httpx.Client rather than AsyncClient."""
    if not user_id:
        return

    if not settings.INTERNAL_ACTIVITY_SECRET:
        logger.debug("INTERNAL_ACTIVITY_SECRET not configured — skipping activity report")
        return

    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"{settings.MAIN_BACKEND_URL.rstrip('/')}/activity/internal/log",
                json={
                    "userId": user_id,
                    "type": activity_type,
                    "message": message,
                    "metadata": metadata or {},
                },
                headers={"X-Internal-Secret": settings.INTERNAL_ACTIVITY_SECRET},
            )
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this must never bubble up
        logger.warning(f"Failed to report activity to main backend: {exc}")
