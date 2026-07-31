"""
Entitlement gate and credit reserve/commit/refund for Brand Identity.

Two independent checks before any generation runs:
  1. Entitlement — does this subscription plan include Brand Identity at all?
     Explorer and Student do not. This is a static check; no DB call needed.
  2. Credits — does the user have enough shared credits remaining this cycle?
     This is an atomic UPDATE against the main GMBTE platform DB.

Reserve happens BEFORE the generation pipeline is queued.
Commit happens in the worker on JobStatus.DONE.
Refund happens in the worker on any failure path.

Every operation appends a row to `ai_credit_transactions` so all AI services
share one audit trail. This is append-only, not a mutable-status row per
reservation — reserve/commit/refund each write their own row.

SCHEMA: built against
  user_credits(user_id, credits_balance, credits_reset_at)
  ai_credit_transactions(id, user_id, service, amount, type, reference_id, created_at)

Reconcile against the real schema by editing this file and core/credits_db.py only.
"""
import logging
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

SERVICE_NAME = "brand_identity"

TIER_RANK_SQL = text("""
    SELECT tier FROM subscriptions WHERE user_id = :user_id
""")

# Matches the rank order of the SubscriptionTier enum in prisma/schema.prisma.
# Values are the actual Postgres enum labels Prisma writes (EXPLORER, STUDENT,
# ...), not the old founder_workspace/founder_pro placeholder strings —
# nothing in the codebase ever produced those; they were dead vocabulary
# invented before the real subscriptions table existed. Users with no row
# yet default to EXPLORER (matches CreditsService.getOrCreateSubscription on
# the NestJS side).
TIER_RANK = {
    "EXPLORER": 0,
    "STUDENT": 1,
    "PROFESSIONAL": 2,
    "FOUNDER": 3,
    "EXECUTIVE": 4,
    "TEAM": 5,
    "ENTERPRISE": 6,
}

MIN_TIER = "EXECUTIVE"


class EntitlementError(Exception):
    """Raised when a plan doesn't include Brand Identity."""


class InsufficientCreditsError(Exception):
    """Raised when the user's credit balance is too low."""


class CreditsDbError(Exception):
    """Raised when the credits DB operation itself fails."""


async def check_entitlement(db: AsyncSession, user_id: str) -> None:
    """
    Gate 1 — is this user's real subscription tier at or above MIN_TIER?
    One cheap read against the shared subscriptions table (same DB as the
    credit ledger). Raises EntitlementError if not.
    """
    result = await db.execute(TIER_RANK_SQL, {"user_id": user_id})
    row = result.fetchone()
    tier = row[0] if row else "EXPLORER"

    if TIER_RANK.get(tier, 0) < TIER_RANK[MIN_TIER]:
        raise EntitlementError(
            f"Your current plan ({tier}) does not include "
            f"Brand Identity. Please upgrade to {MIN_TIER.title()} or above."
        )


async def reserve_credits(
    db: AsyncSession,
    user_id: str,
    cost: int,
    asset_id: str,
) -> None:
    """
    Atomically deduct `cost` credits from the user's balance.
    Fails CLOSED — any DB error raises CreditsDbError rather than granting
    a free generation.

    Writes a 'reserved' row to credit_transactions for the audit trail.
    """
    try:
        result = await db.execute(
            text(
                """
                UPDATE user_credits
                SET credits_balance = credits_balance - :cost
                WHERE user_id = :user_id
                  AND credits_balance >= :cost
                RETURNING credits_balance
                """
            ),
            {"user_id": user_id, "cost": cost},
        )
        row = result.fetchone()
        if row is None:
            raise InsufficientCreditsError(
                f"Insufficient credits. {cost} credits are required for Brand Identity generation."
            )

        await db.execute(
            text(
                """
                INSERT INTO ai_credit_transactions
                    (id, user_id, service, amount, type, reference_id, created_at)
                VALUES
                    (:id, :user_id, :service, :amount, 'reserve', :ref, NOW())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "service": SERVICE_NAME,
                "amount": -cost,
                "ref": asset_id,
            },
        )
        await db.commit()
        logger.info(
            "Credits reserved: user=%s cost=%d asset=%s remaining=%d",
            user_id, cost, asset_id, row[0],
        )

    except (EntitlementError, InsufficientCreditsError):
        raise
    except Exception as exc:
        logger.exception("Credits DB error during reserve for user=%s asset=%s", user_id, asset_id)
        raise CreditsDbError("Credits system unavailable. Please try again.") from exc


async def commit_credits(
    db: AsyncSession,
    user_id: str,
    cost: int,
    asset_id: str,
) -> None:
    """
    Mark a previously reserved credit transaction as 'committed' (generation succeeded).
    This is a ledger update only — the balance was already deducted at reserve time.
    """
    try:
        await db.execute(
            text(
                """
                INSERT INTO ai_credit_transactions
                    (id, user_id, service, amount, type, reference_id, created_at)
                VALUES
                    (:id, :user_id, :service, 0, 'commit', :ref, NOW())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "service": SERVICE_NAME,
                "ref": asset_id,
            },
        )
        await db.commit()
        logger.info("Credits committed: user=%s cost=%d asset=%s", user_id, cost, asset_id)
    except Exception as exc:
        # Non-fatal — generation succeeded, only the ledger update failed.
        # Log for manual reconciliation; do not fail the job.
        logger.error(
            "Failed to commit credit transaction for user=%s asset=%s: %s",
            user_id, asset_id, exc,
        )


async def refund_credits(
    db: AsyncSession,
    user_id: str,
    cost: int,
    asset_id: str,
) -> None:
    """
    Refund `cost` credits when generation fails after a successful reserve.
    Writes a 'refunded' row to the ledger for the audit trail.
    """
    try:
        await db.execute(
            text(
                """
                UPDATE user_credits
                SET credits_balance = credits_balance + :cost
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id, "cost": cost},
        )
        await db.execute(
            text(
                """
                INSERT INTO ai_credit_transactions
                    (id, user_id, service, amount, type, reference_id, created_at)
                VALUES
                    (:id, :user_id, :service, :cost, 'refund', :ref, NOW())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "service": SERVICE_NAME,
                "cost": cost,
                "ref": asset_id,
            },
        )
        await db.commit()
        logger.info("Credits refunded: user=%s cost=%d asset=%s", user_id, cost, asset_id)
    except Exception as exc:
        # Refund failure means the user was charged for a failed generation.
        # Log at ERROR level so this can be caught and corrected manually.
        logger.error(
            "CRITICAL: Failed to refund credits for user=%s asset=%s cost=%d: %s",
            user_id, asset_id, cost, exc,
        )
