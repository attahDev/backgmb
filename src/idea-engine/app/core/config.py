from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    DATABASE_URL: str
    GROQ_API_KEY: str
    JWT_SECRET: str = ""
    SERVICE_NAME: str = "Idea Engine"
    ENVIRONMENT: str = ""
    ALLOWED_ORIGINS: str = ""
    TAVILY_API_KEY: str = ""

    # Points at the main GMBTE platform DB — user_credits + ai_credit_transactions
    # live there, not in this service's own DATABASE_URL.
    CREDITS_DATABASE_URL: str = ""

    # Reuses the same constant set as every other AI microservice's
    # ENTITLED_PLANS rather than inventing a fifth naming convention.
    ENTITLED_PLANS: set[str] = {"founder_workspace", "founder_pro", "team", "enterprise"}
    IDEA_ENGINE_CREDIT_COST: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
