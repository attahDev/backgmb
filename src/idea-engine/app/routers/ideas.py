import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.idea import Idea
from app.schemas.idea import GenerateIdeaRequest, IdeaResponse, IdeaListItem
from app.services.groq_service import generate_idea_content

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ideas", tags=["ideas"])


def _parse_uuid(idea_id: str) -> UUID:
    try:
        return UUID(idea_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid idea ID format")


@router.post("/generate", response_model=IdeaResponse)
async def generate_idea(
    body: GenerateIdeaRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        content = await generate_idea_content(body)
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        logger.exception("Unexpected error generating idea")
        raise HTTPException(status_code=500, detail="Failed to generate idea")

    idea = Idea(
        user_id=user["user_id"],
        business_idea=body.business_idea,
        industry=body.industry,
        target_audience=body.target_audience,
        skills=body.skills,
        budget=body.budget,
        location=body.location,
        experience_level=body.experience_level,
        goal=body.goal,
        content=content,
    )
    db.add(idea)
    await db.commit()
    await db.refresh(idea)

    return IdeaResponse(
        id=idea.id,
        user_id=idea.user_id,
        business_idea=idea.business_idea,
        industry=idea.industry,
        content=content,
        created_at=idea.created_at,
    )


@router.get("", response_model=list[IdeaListItem])
async def list_ideas(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Idea).where(Idea.user_id == user["user_id"]).order_by(Idea.created_at.desc())
    )
    ideas = result.scalars().all()
    return [
        IdeaListItem(
            id=i.id,
            business_idea=i.business_idea,
            industry=i.industry,
            confidence_score=i.content.get("summary_card", {}).get("confidence_score", 0),
            created_at=i.created_at,
        )
        for i in ideas
    ]


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parsed_id = _parse_uuid(idea_id)
    result = await db.execute(
        select(Idea).where(Idea.id == parsed_id, Idea.user_id == user["user_id"])
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    return IdeaResponse(
        id=idea.id,
        user_id=idea.user_id,
        business_idea=idea.business_idea,
        industry=idea.industry,
        content=idea.content,
        created_at=idea.created_at,
    )
