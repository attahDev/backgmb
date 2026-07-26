import { Logger } from '@nestjs/common';

const logger = new Logger('TavilySearch');

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

/**
 * Real-time web search via Tavily — used to ground Groq-generated answers
 * in current information (e.g. "what UK grants are open right now") that
 * a static system prompt can't know. Best-effort only: returns [] on any
 * failure or missing API key, so callers should treat this purely as an
 * enrichment step, never a hard dependency.
 */
export async function searchWeb(
  query: string,
  options: { maxResults?: number; includeDomains?: string[] } = {},
): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: options.maxResults ?? 4,
        include_answer: false,
        include_domains: options.includeDomains,
      }),
    });

    if (!response.ok) {
      logger.warn(`Tavily search failed with status ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const results = payload?.results;
    if (!Array.isArray(results)) return [];

    return results
      .filter((r) => r?.title && r?.url)
      .map((r) => ({
        title: String(r.title),
        url: String(r.url),
        content: String(r.content ?? '').slice(0, 600),
      }));
  } catch (error) {
    logger.warn(`Tavily search errored: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

/** Formats results as a block to drop into a Groq prompt as grounding context. */
export function formatWebResultsForPrompt(results: WebSearchResult[]): string {
  if (results.length === 0) return '';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
    .join('\n\n');
}
