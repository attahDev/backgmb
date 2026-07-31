"""
Entitlement + credit orchestration for idea-engine, mirroring the pattern
used in market_research-main so all AI services share one ledger and one
failure policy against the main GMBTE Postgres DB.

Fails CLOSED on credit-DB errors — a DB error blocks the request rather than
granting a free run.
"""

import logging

from app.core import credits_db
from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_NAME = "idea_engine"


def is_entitled(plan_tier: str) -> bool:
    """Gate 1 — does this plan tier include Idea Engine at all? No DB call."""
    return plan_tier in settings.ENTITLED_PLANS


async def reserve(user_id: str, reference_id: str) -> dict:
    """
    Reserve credits before generating an idea.
    Returns:
        {"status": "ok", "balance": int}
        {"status": "insufficient", "balance": None}
        {"status": "error"}   — DB failure; caller should fail closed (block request)
    """
    try:
        new_balance = await credits_db.reserve_credits(
            user_id=user_id,
            amount=settings.IDEA_ENGINE_CREDIT_COST,
            service=SERVICE_NAME,
            reference_id=reference_id,
        )
        if new_balance is None:
            return {"status": "insufficient", "balance": None}
        return {"status": "ok", "balance": new_balance}
    except Exception as e:
        logger.error(f"Credit reservation failed (fail-closed) user={user_id} ref={reference_id}: {e}")
        return {"status": "error", "balance": None}


async def commit(user_id: str, reference_id: str) -> None:
    """Mark a reservation as successfully consumed once generation actually completes."""
    try:
        await credits_db.commit_reservation(
            user_id=user_id,
            amount=settings.IDEA_ENGINE_CREDIT_COST,
            service=SERVICE_NAME,
            reference_id=reference_id,
        )
    except Exception as e:
        logger.error(f"Credit commit failed to record (job succeeded regardless) user={user_id} ref={reference_id}: {e}")


async def refund(user_id: str, reference_id: str) -> None:
    """Refund a reservation when generation fails after credits were already taken."""
    try:
        new_balance = await credits_db.refund_reservation(
            user_id=user_id,
            amount=settings.IDEA_ENGINE_CREDIT_COST,
            service=SERVICE_NAME,
            reference_id=reference_id,
        )
        if new_balance is None:
            logger.error(f"Refund failed — user_credits row not found for user={user_id}")
        else:
            logger.info(f"Refunded credits to user={user_id} ref={reference_id} new_balance={new_balance}")
    except Exception as e:
        logger.error(f"Credit refund failed user={user_id} ref={reference_id}: {e}")
