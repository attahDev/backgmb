from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    GROQ_API_KEY: str
    JWT_SECRET: str
    REDIS_URL: str
    JWT_ALGORITHM: str = "HS256"
    MEDIA_DIR: str = "media/decks"
    UNSPLASH_ACCESS_KEY: str = ""
    ENVIRONMENT: str = ""
    ALLOWED_ORIGINS: List[str] = []
    RATE_LIMIT_PER_MINUTE: int = 3
    RATE_LIMIT_PER_HOUR: int = 20
    MAIN_BACKEND_URL: str = "https://backgmb.onrender.com"
    INTERNAL_ACTIVITY_SECRET: str = ""

    # Points at the main GMBTE platform DB — user_credits + ai_credit_transactions
    # live there, not in this service's own DATABASE_URL.
    CREDITS_DATABASE_URL: str = ""

    # Matches the rank order of the SubscriptionTier enum in
    # prisma/schema.prisma. Replaces the old founder_workspace/founder_pro
    # ENTITLED_PLANS set — nothing in the codebase ever produced those
    # strings; check_entitlement now queries the real subscriptions table
    # instead of trusting the JWT's unminted "plan" claim.
    MIN_TIER: str = "FOUNDER"
    PITCH_DECK_CREDIT_COST: int = 20

    class Config:
        env_file = ".env"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"


settings = Settings()
