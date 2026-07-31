
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_NAME = "proposal_builder"

TIER_RANK = {
    "EXPLORER": 0, "STUDENT": 1, "PROFESSIONAL": 2,
    "FOUNDER": 3, "EXECUTIVE": 4, "TEAM": 5, "ENTERPRISE": 6,
}
MIN_TIER = "FOUNDER"


async def is_entitled(db: AsyncSession, user_id: str) -> bool:
    """Real subscriptions-table lookup — replaces the old ENTITLED_PLANS
    string-membership check against founder_workspace/founder_pro, which
    nothing in the codebase ever actually produced. `db` here should be a
    credits-DB session (get_credits_db), same connection as reserve/commit/
    refund below."""
    result = await db.execute(
        text("SELECT tier FROM subscriptions WHERE user_id = :user_id"),
        {"user_id": user_id},
    )
    row = result.first()
    tier = row[0] if row else "EXPLORER"
    return TIER_RANK.get(tier, 0) >= TIER_RANK[MIN_TIER]


class InsufficientCredits(Exception):
    pass


async def reserve_credits(db: AsyncSession, user_id: str, cost: int) -> str:
    result = await db.execute(
        text(
            """
            UPDATE user_credits
            SET credits_balance = credits_balance - :cost
            WHERE user_id = :user_id AND credits_balance >= :cost
            RETURNING credits_balance
            """
        ),
        {"user_id": user_id, "cost": cost},
    )
    row = result.first()
    if row is None:
        raise InsufficientCredits(f"Insufficient credits for user {user_id}")

    txn_id = str(uuid.uuid4())
    await db.execute(
        text(
            """
            INSERT INTO ai_credit_transactions (id, user_id, service, amount, type, reference_id, created_at)
            VALUES (:id, :user_id, :service, :amount, 'reserve', :reference_id, now())
            """
        ),
        {
            "id": txn_id,
            "user_id": user_id,
            "service": SERVICE_NAME,
            "amount": -cost,
            "reference_id": txn_id,
        },
    )
    await db.commit()
    return txn_id


async def commit_credits(db: AsyncSession, user_id: str, txn_id: str) -> None:
    await db.execute(
        text(
            """
            INSERT INTO ai_credit_transactions (id, user_id, service, amount, type, reference_id, created_at)
            VALUES (:id, :user_id, :service, 0, 'commit', :reference_id, now())
            """
        ),
        {"id": str(uuid.uuid4()), "user_id": user_id, "service": SERVICE_NAME, "reference_id": txn_id},
    )
    await db.commit()


async def refund_credits(db: AsyncSession, user_id: str, cost: int, txn_id: str) -> None:
    try:
        await db.execute(
            text(
                "UPDATE user_credits SET credits_balance = credits_balance + :cost WHERE user_id = :user_id"
            ),
            {"user_id": user_id, "cost": cost},
        )
        await db.execute(
            text(
                """
                INSERT INTO ai_credit_transactions (id, user_id, service, amount, type, reference_id, created_at)
                VALUES (:id, :user_id, :service, :amount, 'refund', :reference_id, now())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "service": SERVICE_NAME,
                "amount": cost,
                "reference_id": txn_id,
            },
        )
        await db.commit()
    except Exception as e:
        logger.critical(
            "REFUND FAILED for user %s, txn %s, cost %s — needs manual credit correction: %s",
            user_id, txn_id, cost, e,
        )


def entitlement_error() -> HTTPException:
    return HTTPException(
        status_code=403,
        detail="Your plan doesn't include Proposal AI. Upgrade to Founder Workspace or higher to generate proposals.",
    )


def insufficient_credits_error() -> HTTPException:
    return HTTPException(
        status_code=402,
        detail=f"Not enough AI credits left this billing cycle. Proposal generation costs {settings.PROPOSAL_CREDIT_COST} credits.",
    )
