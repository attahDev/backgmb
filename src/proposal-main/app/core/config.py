from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  
    DATABASE_URL: str
    REDIS_URL: str = ""
    GROQ_API_KEY: str
    JWT_SECRET: str = ""
    SERVICE_NAME: str = "Proposal Builder AI"
    ENVIRONMENT: str = ""
    ALLOWED_ORIGINS: str = ""
    RATE_LIMIT_PER_MINUTE: int = 5
    RATE_LIMIT_PER_HOUR: int = 30
    MAIN_BACKEND_URL: str = "https://backgmb.onrender.com"
    INTERNAL_ACTIVITY_SECRET: str = ""

    # Points at the main GMBTE platform DB — user_credits + ai_credit_transactions
    # live there, not in this service's own DATABASE_URL.
    CREDITS_DATABASE_URL: str = ""
    PROPOSAL_CREDIT_COST: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
