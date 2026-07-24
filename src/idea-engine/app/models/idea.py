import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Idea(Base):
    """
    One row = one generated idea. `content` holds the full IdeaContent JSON
    (summary, market insights, feasibility, revenue, scores, next steps,
    competitors, target audience, roadmap, financials, business model,
    executive summary, next actions) — everything the Dashboard, Idea
    Generator, Opportunity Insights, and Business Plan tabs render.
    """

    __tablename__ = "ideas"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    business_idea: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[str] = mapped_column(String, default="")
    target_audience: Mapped[str] = mapped_column(String, default="")
    skills: Mapped[str] = mapped_column(String, default="")
    budget: Mapped[str] = mapped_column(String, default="")
    location: Mapped[str] = mapped_column(String, default="")
    experience_level: Mapped[str] = mapped_column(String, default="")
    goal: Mapped[str] = mapped_column(String, default="")

    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
