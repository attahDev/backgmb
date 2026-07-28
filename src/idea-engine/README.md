# Idea Engine

Generates one unified "Idea" result from a founder's raw business idea + context, using Groq
(`llama-3.3-70b-versatile`). This single result is the shared data source for four screens in the
AI Business Studio:

- **Dashboard** (`AIBusinessStudioSection`) — summary_card, score_breakdown
- **Idea Generator** (`IGDashboardSection`) — summary_card, market_insights, feasibility_card,
  revenue_chart, score_breakdown, next_steps
- **Opportunity Insights** (`MRDashboardSection`) — market_insights, competitors, target_audience,
  competitive_edge
- **Business Plan** (`BPTabs` → Roadmap / Financials / Business Plan) — roadmap, financials,
  business_model, executive_summary, next_actions

Market Research (the Tiingo/Tavily-backed standalone tool at `/dashboard/market-research`) is
untouched — this service is unrelated to it.

## Env vars

```
DATABASE_URL=postgresql+asyncpg://...
GROQ_API_KEY=...
JWT_SECRET=<same secret as the main GMBTE auth service>
ENVIRONMENT=production
ALLOWED_ORIGINS=https://gmbtefro-pfst.vercel.app
```

`JWT_SECRET` must match the main NestJS auth service's secret — tokens are verified here, never
reissued, same pattern as brand-identity and the other microservices.

## Endpoints

- `POST /api/ideas/generate` — body matches `GenerateIdeaRequest` (business_idea, industry,
  target_audience, skills, budget, location, experience_level, goal). Returns the full
  `IdeaResponse` and persists it.
- `GET /api/ideas` — history list for the current user (id, business_idea, industry,
  confidence_score, created_at) — feeds `IGPreviousIdeas` / `MRPreviousReports`.
- `GET /api/ideas/{id}` — full `IdeaResponse` for one idea — used when a user reopens a past idea
  from the dashboard/history and wants to see it across all four screens.
- `GET /health`

## Integration still needed (not done in this pass)

1. **NestJS gateway**: add a thin proxy module (`src/idea-engine/`) mirroring
   `business-planner.controller.ts` — `POST /idea-engine/generate`, `GET /idea-engine/history`,
   `GET /idea-engine/:id` → forward to this service with the user's JWT.
2. **Frontend shared idea state**: add an `ideaId` to the `/ai-dashboard` route (e.g.
   `/dashboard/idea-generator?ideaId=...`) or a small React context, so Idea Generator,
   Opportunity Insights, and Business Plan all read the *same* generated idea instead of each
   defaulting to their hardcoded "AI Fitness Coaching App" props.
3. **Wire the already-prop-ready components** — every component in `IdeaGenerator/`,
   `MarketResearchSection/`, and `BusinessPlanSection/` already accepts the real data as props
   (they just default to hardcoded values). Map `IdeaContent` fields onto those props 1:1 (the
   schema in `app/schemas/idea.py` was designed to match them field-for-field).
4. **Un-comment the routes** in `frogmbte/src/App.tsx` (`ai-studio`, `idea-generator`,
   `opportunity-insights`, `business-plan`) once each is wired, replacing `<ComingSoon />`.
5. **Business planner overlap**: decide whether the existing `business-planner` HF-space proxy
   stays for a lighter/legacy flow or gets retired in favor of this service for the AI Studio path.
