import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCareerPathDto } from './dto/create-career-path.dto';
import { UpdateCareerPathDto } from './dto/update-career-path.dto';
import { AddCareerPathSkillDto } from './dto/add-career-path-skill.dto';

// Same model choice as pdf-extraction.service.ts — llama-3.3-70b-versatile is
// being retired by Groq, gpt-oss-120b is the current general-purpose stand-in.
const GROQ_MODEL = process.env.GROQ_EXTRACTION_MODEL || 'openai/gpt-oss-120b';

const GAP_ANALYSIS_SYSTEM_PROMPT = `You are a supportive but direct career mentor. Given a mentee's target career path and which required skills they have vs. haven't logged yet, respond with ONLY valid JSON, no markdown fences, matching exactly:
{
  "summary": string (2-3 encouraging sentences on where they stand),
  "priorities": string[] (2-3 specific skills from the missing list to focus on next, ordered by importance)
}
Be concrete and specific to the skill names given — don't invent skills that weren't listed.`;

function normalize(name: string) {
  return name.trim().toLowerCase();
}

@Injectable()
export class CareerPathsService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────── Public / mentee-facing ─────────────────────────

  async listActivePaths() {
    return this.prisma.careerPath.findMany({
      where: { isActive: true },
      include: { requiredSkills: true },
      orderBy: { title: 'asc' },
    });
  }

  async setMyGoal(userId: string, careerPathId: string) {
    const path = await this.prisma.careerPath.findUnique({ where: { id: careerPathId } });
    if (!path) throw new NotFoundException('Career path not found');

    // upsert: picking a new path replaces the old goal and clears the stale
    // cached AI summary so the next readiness check regenerates it fresh.
    return this.prisma.menteeCareerGoal.upsert({
      where: { menteeId: userId },
      create: { menteeId: userId, careerPathId },
      update: { careerPathId, aiSummary: null, aiSummaryAt: null, aiSummarySkillsCount: null, setAt: new Date() },
    });
  }

  /** Path-aware readiness: precise percentage + gap list + a cached AI narrative.
   *  This is separate from mentors.service.ts#stats' careerReadinessPercent,
   *  which is a coarser activity signal that works even with no path chosen. */
  async getMyReadiness(userId: string) {
    const goal = await this.prisma.menteeCareerGoal.findUnique({
      where: { menteeId: userId },
      include: { careerPath: { include: { requiredSkills: true } } },
    });
    if (!goal) return { hasGoal: false as const };

    const skillLogs = await this.prisma.skillLog.findMany({
      where: { menteeId: userId },
      select: { skillName: true, confirmedByMentor: true },
    });
    // Confirmed skills count in full; self-reported-only ones count at half
    // weight — reflects them not yet being validated by a mentor.
    const loggedByName = new Map<string, boolean>(); // skillName -> confirmed
    for (const log of skillLogs) {
      const key = normalize(log.skillName);
      if (!loggedByName.has(key) || log.confirmedByMentor) {
        loggedByName.set(key, loggedByName.get(key) || log.confirmedByMentor);
      }
    }

    let earned = 0;
    let total = 0;
    const matched: { skillName: string; weight: number; confirmed: boolean }[] = [];
    const missing: { skillName: string; weight: number }[] = [];

    for (const req of goal.careerPath.requiredSkills) {
      total += req.weight;
      const confirmed = loggedByName.get(normalize(req.skillName));
      if (confirmed === undefined) {
        missing.push({ skillName: req.skillName, weight: req.weight });
      } else {
        earned += confirmed ? req.weight : req.weight * 0.5;
        matched.push({ skillName: req.skillName, weight: req.weight, confirmed });
      }
    }

    const readinessPercent = total > 0 ? Math.round(Math.min(100, (earned / total) * 100)) : 0;
    missing.sort((a, b) => b.weight - a.weight);

    const aiSummary = await this.getOrRefreshAiSummary(goal, skillLogs.length, matched, missing);

    return {
      hasGoal: true as const,
      careerPath: { id: goal.careerPath.id, title: goal.careerPath.title, description: goal.careerPath.description },
      readinessPercent,
      matched,
      missing,
      aiSummary,
    };
  }

  /** Regenerates the AI gap-analysis only when the mentee's logged-skill
   *  count changed since the last generation, so a dashboard refresh doesn't
   *  cost an AI call every time nothing has actually changed. */
  private async getOrRefreshAiSummary(
    goal: { id: string; aiSummary: string | null; aiSummarySkillsCount: number | null; careerPath: { title: string } },
    currentSkillCount: number,
    matched: { skillName: string; confirmed: boolean }[],
    missing: { skillName: string }[],
  ): Promise<{ summary: string; priorities: string[] } | null> {
    if (goal.aiSummary && goal.aiSummarySkillsCount === currentSkillCount) {
      try {
        return JSON.parse(goal.aiSummary);
      } catch {
        // fall through and regenerate if the cached blob is somehow corrupt
      }
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null; // AI is a nice-to-have here — don't fail readiness without it

    const userPrompt = [
      `Target career path: ${goal.careerPath.title}`,
      `Skills already logged: ${matched.map((m) => `${m.skillName}${m.confirmed ? '' : ' (self-reported, not yet mentor-confirmed)'}`).join(', ') || 'none yet'}`,
      `Skills still missing: ${missing.map((m) => m.skillName).join(', ') || 'none — all required skills logged'}`,
    ].join('\n');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: GAP_ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      await this.prisma.menteeCareerGoal.update({
        where: { id: goal.id },
        data: { aiSummary: raw, aiSummaryAt: new Date(), aiSummarySkillsCount: currentSkillCount },
      });
      return parsed;
    } catch {
      return null; // readiness numbers still work without the narrative
    }
  }

  // ───────────────────────── Admin ─────────────────────────

  async adminList() {
    return this.prisma.careerPath.findMany({
      include: { requiredSkills: true, _count: { select: { menteeGoals: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCareerPathDto) {
    if (!dto.requiredSkills?.length) {
      throw new BadRequestException('A career path needs at least one required skill');
    }
    return this.prisma.careerPath.create({
      data: {
        title: dto.title,
        description: dto.description,
        requiredSkills: {
          create: dto.requiredSkills.map((s) => ({ skillName: s.skillName.trim(), weight: s.weight ?? 1 })),
        },
      },
      include: { requiredSkills: true },
    });
  }

  async update(id: string, dto: UpdateCareerPathDto) {
    const path = await this.prisma.careerPath.findUnique({ where: { id } });
    if (!path) throw new NotFoundException('Career path not found');
    return this.prisma.careerPath.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const path = await this.prisma.careerPath.findUnique({ where: { id } });
    if (!path) throw new NotFoundException('Career path not found');
    await this.prisma.careerPath.delete({ where: { id } });
    return { message: 'Career path removed' };
  }

  async addSkill(careerPathId: string, dto: AddCareerPathSkillDto) {
    const path = await this.prisma.careerPath.findUnique({ where: { id: careerPathId } });
    if (!path) throw new NotFoundException('Career path not found');
    return this.prisma.careerPathSkill.create({
      data: { careerPathId, skillName: dto.skillName.trim(), weight: dto.weight ?? 1 },
    });
  }

  async removeSkill(skillId: string) {
    const skill = await this.prisma.careerPathSkill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('Skill not found on this career path');
    await this.prisma.careerPathSkill.delete({ where: { id: skillId } });
    return { message: 'Skill removed' };
  }
}
