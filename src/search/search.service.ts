import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type SearchResultType = 'opportunity' | 'event' | 'course';

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  slug?: string; // courses link by slug, not id
  score: number;
};

const GROQ_MODEL = process.env.GROQ_EXTRACTION_MODEL || 'openai/gpt-oss-120b';

/**
 * Platform-wide search across Opportunities, Events, and Courses.
 *
 * Algorithm: each candidate row is scored by where the query matched
 * (exact title match scores highest, then title-starts-with, then
 * title-contains, then a match in description/tags/category/company/
 * location) rather than just returning an unordered `contains` dump —
 * that's the "algo" part.
 *
 * On top of that, if the literal keyword search comes back thin (fewer
 * than 3 total hits), we ask Groq to expand the query into related terms
 * (synonyms, adjacent job titles, category names) and re-run the same
 * scored search with those terms merged in — e.g. "coder" also matching
 * "developer" / "software engineer" opportunities. That's the "AI" part,
 * and it's a pure best-effort enhancement: if Groq is unavailable or
 * returns nothing useful, the literal results still stand on their own.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    let results = await this.runSearch(q);

    if (results.length < 3) {
      const expandedTerms = await this.expandQueryWithGroq(q);
      if (expandedTerms.length > 0) {
        const extra = (
          await Promise.all(expandedTerms.map((term) => this.runSearch(term)))
        ).flat();

        const seen = new Set(results.map((r) => `${r.type}:${r.id}`));
        for (const item of extra) {
          const key = `${item.type}:${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            // Terms from query expansion rank slightly below literal matches.
            results.push({ ...item, score: item.score * 0.8 });
          }
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 30);
  }

  private async runSearch(q: string): Promise<SearchResult[]> {
    const [opportunities, events, courses] = await Promise.all([
      this.searchOpportunities(q),
      this.searchEvents(q),
      this.searchCourses(q),
    ]);
    return [...opportunities, ...events, ...courses];
  }

  private score(q: string, title: string): number {
    const lowerQ = q.toLowerCase();
    const lowerTitle = title.toLowerCase();
    if (lowerTitle === lowerQ) return 100;
    if (lowerTitle.startsWith(lowerQ)) return 80;
    if (lowerTitle.includes(lowerQ)) return 60;
    // Matched via a secondary field (description/company/tags/etc.), not the title.
    return 30;
  }

  private async searchOpportunities(q: string): Promise<SearchResult[]> {
    const rows = await this.prisma.opportunity.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 15,
    });

    return rows.map((r) => ({
      type: 'opportunity' as const,
      id: r.id,
      title: r.title,
      subtitle: r.company,
      description: r.description ?? undefined,
      score: this.score(q, r.title),
    }));
  }

  private async searchEvents(q: string): Promise<SearchResult[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 15,
    });

    return rows.map((r) => ({
      type: 'event' as const,
      id: r.id,
      title: r.title,
      subtitle: r.location ?? undefined,
      description: r.description ?? undefined,
      score: this.score(q, r.title),
    }));
  }

  private async searchCourses(q: string): Promise<SearchResult[]> {
    const rows = await this.prisma.course.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      },
      take: 15,
    });

    return rows.map((r) => ({
      type: 'course' as const,
      id: r.id,
      slug: r.slug,
      title: r.title,
      subtitle: r.category ?? undefined,
      description: r.description ?? undefined,
      score: this.score(q, r.title),
    }));
  }

  /** Best-effort query expansion. Returns [] on any failure or missing key — never throws. */
  private async expandQueryWithGroq(q: string): Promise<string[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: `You expand short search queries for a platform listing business opportunities, events, and courses for young African tech talent. Given a query, return ONLY valid JSON: {"terms": string[]} — up to 4 closely related single words or short phrases (synonyms, adjacent job titles, or category names). No markdown, no explanation. Example: "coder" -> {"terms": ["developer", "software engineer", "programmer"]}`,
            },
            { role: 'user', content: q },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) return [];
      const payload = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw) return [];

      const parsed: { terms?: string[] } = JSON.parse(raw);
      return Array.isArray(parsed.terms) ? parsed.terms.filter(Boolean).slice(0, 4) : [];
    } catch (error) {
      this.logger.warn(`Search query expansion failed: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }
}
