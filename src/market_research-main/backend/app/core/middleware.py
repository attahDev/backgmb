import uuid
import logging
import time
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from sqlalchemy import text

from app.core import credits_db
from app.core.config import settings

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = {"active", "trialing"}

# Matches the rank order of the SubscriptionTier enum in prisma/schema.prisma.
TIER_RANK = {
    "EXPLORER": 0, "STUDENT": 1, "PROFESSIONAL": 2,
    "FOUNDER": 3, "EXECUTIVE": 4, "TEAM": 5, "ENTERPRISE": 6,
}

_TIER_SQL = text("SELECT tier FROM subscriptions WHERE user_id = :user_id")


async def _lookup_plan_tier(user_id: str) -> str:
    """
    Reads the real tier from the shared subscriptions table (same DB as the
    credit ledger) rather than trusting an unminted JWT claim or hardcoding
    a value — every production request previously got plan_tier="explorer"
    unconditionally here, regardless of the user's actual subscription.
    Fails to EXPLORER on any DB error (fail-closed for entitlement — better
    to under-grant access than over-grant it).
    """
    try:
        Session = credits_db.get_credits_session_factory()
        async with Session() as session:
            result = await session.execute(_TIER_SQL, {"user_id": user_id})
            row = result.first()
            return row[0] if row else "EXPLORER"
    except Exception as e:
        logger.error(f"plan_tier lookup failed for user={user_id}, defaulting to EXPLORER: {e}")
        return "EXPLORER"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start_time) * 1000)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)

        logger.info(
            f"method={request.method} path={request.url.path} "
            f"status={response.status_code} duration_ms={duration_ms} "
            f"request_id={request_id}"
        )
        return response


class AuthMiddleware(BaseHTTPMiddleware):
    PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next) -> Response:

        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Development bypass — X-Plan-Tier header lets local testing pick a
        # tier directly without a real subscriptions row. Production always
        # uses the real lookup below, never a header.
        if settings.app_env == "development":
            request.state.user_id = request.headers.get(
                "X-User-ID",
                "a092213e-3d63-4895-b35e-8c76cd9e9119"
            )
            request.state.plan_tier = request.headers.get(
                "X-Plan-Tier",
                "FOUNDER"
            )
            request.state.subscription_status = "active"

            return await call_next(request)

        # Production JWT authentication
        authorization = request.headers.get("Authorization")

        if not authorization or not authorization.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "UNAUTHENTICATED",
                        "message": "Missing bearer token",
                    },
                },
            )

        token = authorization.split(" ")[1]

        try:
            from jose import jwt, JWTError

            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
            )

            user_id = payload.get("sub")

            if not user_id:
                raise JWTError()

        except Exception as e:
            logger.error(f"JWT validation failed: {e}")

            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Invalid authentication token",
                    },
                },
            )

        request.state.user_id = user_id
        request.state.plan_tier = await _lookup_plan_tier(user_id)
        request.state.subscription_status = "active"

        return await call_next(request)
