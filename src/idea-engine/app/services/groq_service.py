import asyncio
import json
import logging
import re
from functools import partial

from groq import Groq, APIConnectionError, APIStatusError

from app.core.config import settings
from app.schemas.idea import IdeaContent

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


SYSTEM_PROMPT = """You are a senior startup analyst and venture strategist. Given a founder's raw
business idea and context, produce a complete, realistic validation-to-execution package as a
single JSON object. This output feeds four different product screens for the same idea, so every
number and claim must be internally consistent across sections (e.g. the confidence score in
summary_card should roughly agree with feasibility_card.fit_score and score_breakdown values;
revenue_chart.projection totals should roughly match financials.chart figures).

Return ONLY a valid JSON object with exactly these top-level keys:

- summary_card: { title, description, confidence_score (0-100 int) }
- market_insights: {
    demand: { label ("Low"/"Medium"/"High"), score (0-10 int) },
    competition: { label, score (0-10 int) },
    startup_cost: string ("Low", "Low-Med", "Medium", "High"),
    profit_potential: string ("Low", "Medium", "High"),
    opportunity: string (2-3 sentences)
  }
- feasibility_card: { fit_score (0-100 int), difficulty ("Easy"/"Moderate"/"Hard"),
    strengths (3-4 short strings), risks (3-4 short strings) }
- revenue_chart: { model (short label), scalability ("Low"/"Medium"/"High"),
    projection: 6 objects of { month ("Month 1".."Month 6"), revenue (number, realistic
    monotonically-increasing USD figures given the stated budget/goal) } }
- score_breakdown: { market, profit, execution, scalability — each 0-10 int }
- next_steps: 3-4 short actionable strings
- competitors: 2-3 objects of { name (real or realistic competitor/product name),
    description (short), score (0-100 int, their estimated market strength) }
- target_audience: 4 objects of { text (one full sentence insight), segment (one of
    "primary", "secondary", "market_size", "willingness_to_pay") } — exactly one of each segment
- competitive_edge: 3 short strings describing this specific idea's edge over competitors
- roadmap: { phases: 3-4 objects of { tag ("WEEK 1-2" style range), title (phase name),
    items: 3-4 objects of { text, done (boolean, false for all since this is a fresh idea) } } }
- financials: {
    stats: 3 objects of { label ("STARTUP COST" / "MONTHLY REVENUE (PROJECTED)" /
      "BREAK-EVEN POINT" or similar), value (short formatted string e.g. "$4,600"),
      sub (short context string), badge (optional short string like "+18% MoM" or null) },
    chart: 6 objects of { label ("Month 1".."Month 6"), amount (formatted currency string),
      value (0-100 int, relative bar height, consistent with revenue_chart.projection) }
  }
- business_model: 3 objects of { label (short e.g. "Pricing", "Revenue streams", "Target"),
    value (one sentence) }
- executive_summary: 2-3 sentences describing the business in plain, confident language
- next_actions: 4 short concrete action strings

RULES:
- Ground every figure in the founder's stated budget, skills, location, and goal — do not ignore
  the input context.
- Numbers must be internally consistent (see above). Do not contradict yourself across sections.
- No markdown, no code fences, no commentary outside the JSON object.
- The entire response must be parseable by Python's json.loads() with zero modification.
"""

STRICT_SYSTEM_PROMPT = SYSTEM_PROMPT + (
    "\n\nCRITICAL: Your previous response failed JSON parsing. Return ONLY the raw JSON object. "
    "No backticks, no prose, no explanation before or after."
)


def _parse_groq_response(raw: str) -> dict:
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        cleaned = "\n".join(inner).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    if start != -1:
        decoder = json.JSONDecoder()
        try:
            obj, _ = decoder.raw_decode(cleaned, start)
            return obj
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse Groq response as JSON after all attempts.")


def _call_groq_sync(prompt: str, system: str) -> str:
    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
        max_tokens=8192,
        timeout=120,
    )
    return response.choices[0].message.content


async def _call_groq(prompt: str, system: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_call_groq_sync, prompt, system))


async def generate_idea_content(payload) -> dict:
    context_parts = [f"Business idea: {payload.business_idea}"]
    if payload.industry:
        context_parts.append(f"Industry: {payload.industry}")
    if payload.target_audience:
        context_parts.append(f"Target audience: {payload.target_audience}")
    if payload.skills:
        context_parts.append(f"Founder skills: {payload.skills}")
    if payload.budget:
        context_parts.append(f"Available budget: {payload.budget}")
    if payload.location:
        context_parts.append(f"Location: {payload.location}")
    if payload.experience_level:
        context_parts.append(f"Experience level: {payload.experience_level}")
    if payload.goal:
        context_parts.append(f"Goal: {payload.goal}")
    prompt = "\n".join(context_parts)

    def _validate(data: dict) -> dict:
        missing = [k for k in IdeaContent.model_fields.keys() if k not in data]
        if missing:
            raise ValueError(f"Groq response missing fields: {missing}")
        return data

    def _coerce_str_fields(data: dict) -> dict:
        """Groq sometimes returns a prose field ('2-3 sentences') as a JSON list
        of sentences instead of one string, even though the schema expects a
        plain string. Join those back into a single string so they don't fail
        Pydantic validation downstream."""
        if isinstance(data.get("executive_summary"), list):
            data["executive_summary"] = " ".join(str(s) for s in data["executive_summary"])

        market = data.get("market_insights")
        if isinstance(market, dict) and isinstance(market.get("opportunity"), list):
            market["opportunity"] = " ".join(str(s) for s in market["opportunity"])

        return data

    try:
        raw = await _call_groq(prompt, SYSTEM_PROMPT)
        return _coerce_str_fields(_validate(_parse_groq_response(raw)))
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("First Groq attempt failed to parse/validate: %s. Retrying...", e)
        try:
            raw = await _call_groq(prompt, STRICT_SYSTEM_PROMPT)
            return _coerce_str_fields(_validate(_parse_groq_response(raw)))
        except (json.JSONDecodeError, ValueError) as e2:
            logger.error("Second Groq attempt also failed: %s", e2)
            raise ValueError("Groq returned malformed JSON after 2 attempts.") from e2
    except APIConnectionError as e:
        logger.error("Groq API unreachable: %s | cause: %s", e, e.__cause__)
        raise ConnectionError(f"Groq API is unreachable: {e}") from e
    except APIStatusError as e:
        logger.error("Groq API returned an error status: %s", e)
        raise
