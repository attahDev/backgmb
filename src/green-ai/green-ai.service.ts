import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type AdvisorCard = {
  title: string;
  description: string;
  variant: 'danger' | 'info' | 'neutral';
  badge?: string;
};

const GROQ_MODEL = process.env.GROQ_EXTRACTION_MODEL || 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `You are the AI Green Advisor for GMBTE, a sustainability coach for young African tech talent. Given a summary of a user's real logged green actions, supported green projects, and eco-credit activity, respond with ONLY valid JSON, no markdown fences, matching exactly:
{
  "cards": [
    { "title": string, "description": string (1-2 concrete, encouraging sentences referencing their actual data where possible), "variant": "danger" | "info" | "neutral", "badge": string (optional, e.g. "High Priority") }
  ]
}
Return exactly 3 cards. Be specific and personal — reference real numbers/areas from the data given rather than generic advice. If the user has no logged activity yet, gently nudge them to log their first green action instead of inventing data.`;

/**
 * Real AI Green Advisor: pulls the user's actual green-impact data
 * (GreenAction, GreenProjectSupport, CreditTransaction) and asks Groq to
 * turn it into personalized advisor cards. Falls back to a static,
 * clearly-labelled starter set if there's no Groq key configured or the
 * call fails, so the UI never breaks.
 */
@Injectable()
export class GreenAiService {
  private readonly logger = new Logger(GreenAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAdvice(userId: string): Promise<AdvisorCard[]> {
    const [actions, supportedProjects, creditTx] = await Promise.all([
      this.prisma.greenAction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.greenProjectSupport.findMany({
        where: { userId },
        include: { project: { select: { title: true } } },
      }),
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return this.fallbackCards(actions.length > 0);
    }

    const totalCo2 = actions.reduce((sum, a) => sum + (a.co2OffsetKg || 0), 0);
    const dataSummary = {
      totalGreenActionsLogged: actions.length,
      totalCo2OffsetKg: Math.round(totalCo2 * 10) / 10,
      recentActionTypes: actions.slice(0, 5).map((a) => ({ type: a.type, area: a.area })),
      supportedProjects: supportedProjects.map((s) => s.project.title),
      creditActivityCount: creditTx.length,
    };

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(dataSummary) },
          ],
          temperature: 0.6,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) return this.fallbackCards(actions.length > 0);

      const payload = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw) return this.fallbackCards(actions.length > 0);

      const parsed: { cards: AdvisorCard[] } = JSON.parse(raw);
      if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        return this.fallbackCards(actions.length > 0);
      }
      return parsed.cards;
    } catch (error) {
      this.logger.error('Green Advisor AI call failed', error as Error);
      return this.fallbackCards(actions.length > 0);
    }
  }

  private fallbackCards(hasActivity: boolean): AdvisorCard[] {
    if (!hasActivity) {
      return [
        {
          title: 'Log your first green action',
          description:
            'You haven\u2019t logged any sustainability actions yet \u2014 add one from the Climate dashboard and your advisor will start giving you personalized tips.',
          variant: 'info',
          badge: 'Get started',
        },
      ];
    }
    return [
      {
        title: 'Keep your streak going',
        description:
          'Log a green action this week to keep building your impact history and unlock more personalized advice.',
        variant: 'neutral',
      },
    ];
  }
}
