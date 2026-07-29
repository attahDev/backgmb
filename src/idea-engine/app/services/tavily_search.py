import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TAVILY_URL = "https://api.tavily.com/search"


async def search_web(query: str, max_results: int = 4) -> list[dict]:
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TAVILY_URL,
                json={
                    "api_key": api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                    "include_answer": False,
                },
            )

        if response.status_code != 200:
            logger.warning("Tavily search failed with status %s", response.status_code)
            return []

        payload = response.json()
        results = payload.get("results")
        if not isinstance(results, list):
            return []

        return [
            {
                "title": str(r.get("title", "")),
                "url": str(r.get("url", "")),
                "content": str(r.get("content", ""))[:600],
            }
            for r in results
            if r.get("title") and r.get("url")
        ]
    except Exception as e:  # noqa: BLE001 — best-effort, never block generation
        logger.warning("Tavily search errored: %s", e)
        return []


def format_web_results_for_prompt(results: list[dict]) -> str:
    """Formats results as a block to drop into the Groq system prompt as grounding context."""
    if not results:
        return ""

    return "\n\n".join(
        f"[{i + 1}] {r['title']}\n{r['content']}\nSource: {r['url']}"
        for i, r in enumerate(results)
    )
