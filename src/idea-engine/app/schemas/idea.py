from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ---------- request ----------

class GenerateIdeaRequest(BaseModel):
    business_idea: str
    industry: str = ""
    target_audience: str = ""
    skills: str = ""
    budget: str = ""
    location: str = ""
    experience_level: str = ""
    goal: str = ""


# ---------- shared sub-shapes ----------

class ScoredLabel(BaseModel):
    label: str
    score: int = 0


class SummaryCard(BaseModel):
    title: str
    description: str
    confidence_score: int


class MarketInsights(BaseModel):
    demand: ScoredLabel
    competition: ScoredLabel
    startup_cost: str
    profit_potential: str
    opportunity: str


class FeasibilityCard(BaseModel):
    fit_score: int
    difficulty: str
    strengths: list[str]
    risks: list[str]


class RevenueMonth(BaseModel):
    month: str
    revenue: float


class RevenueChart(BaseModel):
    model: str
    scalability: str
    projection: list[RevenueMonth]


class ScoreBreakdown(BaseModel):
    market: int
    profit: int
    execution: int
    scalability: int


class Competitor(BaseModel):
    name: str
    description: str
    score: int


class AudienceInsight(BaseModel):
    text: str
    segment: str  # primary | secondary | market_size | willingness_to_pay


class RoadmapItem(BaseModel):
    text: str
    done: bool = False


class RoadmapPhase(BaseModel):
    tag: str
    title: str
    items: list[RoadmapItem]


class Roadmap(BaseModel):
    phases: list[RoadmapPhase]


class FinancialStat(BaseModel):
    label: str
    value: str
    sub: str
    badge: Optional[str] = None


class FinancialChartPoint(BaseModel):
    label: str
    amount: str
    value: int  # 0-100 relative bar height


class Financials(BaseModel):
    stats: list[FinancialStat]
    chart: list[FinancialChartPoint]


class BusinessModelItem(BaseModel):
    label: str
    value: str


# ---------- the full unified contract ----------

class IdeaContent(BaseModel):
    summary_card: SummaryCard
    market_insights: MarketInsights
    feasibility_card: FeasibilityCard
    revenue_chart: RevenueChart
    score_breakdown: ScoreBreakdown
    next_steps: list[str]
    competitors: list[Competitor]
    target_audience: list[AudienceInsight]
    competitive_edge: list[str]
    roadmap: Roadmap
    financials: Financials
    business_model: list[BusinessModelItem]
    executive_summary: str
    next_actions: list[str]


class IdeaResponse(BaseModel):
    id: UUID
    user_id: str
    business_idea: str
    industry: str
    content: IdeaContent
    created_at: datetime

    class Config:
        from_attributes = True


class IdeaListItem(BaseModel):
    id: UUID
    business_idea: str
    industry: str
    confidence_score: int
    created_at: datetime
