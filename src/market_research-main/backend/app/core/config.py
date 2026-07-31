from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = ""
    db_schema: str = "market_research"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    redis_url: str = "redis://localhost:6379/0"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    tiingo_api_key: str = ""
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    coingecko_api_key: str = ""
    newsapi_key: str = ""
    tavily_api_key: str = ""
    classifier_confidence_threshold: float = 0.75
    classifier_max_groq_retries: int = 2
    cache_ttl_crypto: int = 120
    cache_ttl_stocks: int = 300
    cache_ttl_commodity: int = 300
    cache_ttl_industry: int = 7200
    cache_ttl_general: int = 7200
    job_processing_timeout_seconds: int = 180
    job_result_expiry_seconds: int = 7200
    job_inflight_lock_seconds: int = 30
    job_max_retries: int = 2
    app_env: str = "development"
    log_level: str = "INFO"
    allowed_origins: list[str] = []
    idempotency_key_ttl_seconds: int = 120
    rate_limit_per_minute: int = 10
    rate_limit_per_hour: int = 100
    bypass_rate_limits: bool = True
    main_backend_url: str = "https://backgmb.onrender.com"
    internal_activity_secret: str = ""

    # Points at the main GMBTE platform DB — user_credits + ai_credit_transactions
    # live there, not in this service's own database_url.
    credits_database_url: str = ""

    def get_cache_ttl(self, category: str) -> int:
        return {
            "crypto":    self.cache_ttl_crypto,
            "stock":     self.cache_ttl_stocks,
            "commodity": self.cache_ttl_commodity,
            "industry":  self.cache_ttl_industry,
            "general":   self.cache_ttl_general,
        }.get(category, self.cache_ttl_general)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

SERVICE_NAME = "market_research"

# Matches the rank order of the SubscriptionTier enum in prisma/schema.prisma
# and request.state.plan_tier, which middleware.py now populates from the
# real subscriptions table. Replaces the old founder_workspace/founder_pro
# ENTITLED_PLANS set — nothing in the codebase ever produced those strings;
# they were dead vocabulary invented before the real subscriptions table
# existed.
TIER_RANK = {
    "EXPLORER": 0, "STUDENT": 1, "PROFESSIONAL": 2,
    "FOUNDER": 3, "EXECUTIVE": 4, "TEAM": 5, "ENTERPRISE": 6,
}
MIN_TIER = "FOUNDER"

# Cache-hit cost sits in the doc's stated 1-2 range, not yet pinned to one
# exact number — using 2 as the conservative default. Fresh-fetch cost is
# confirmed at 15 (updated from the old placeholder of 8).
CREDIT_COST_CACHE = 2
CREDIT_COST_FRESH = 15
