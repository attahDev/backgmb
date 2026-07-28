"""Best-effort reporting of user activity back to the main backend, so
the admin portal's Overview page has something to show for Proposal
Builder usage. Never allowed to break the caller: any failure here is
logged and swallowed, since a missed activity-log entry is a much
smaller problem than a failed proposal generation.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def report_activity(user_id: str | None, activity_type: str, message: str, metadata: dict | None = None) -> None:
    if not user_id:
        return

    if not settings.INTERNAL_ACTIVITY_SECRET:
        logger.debug("INTERNAL_ACTIVITY_SECRET not configured — skipping activity report")
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
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
