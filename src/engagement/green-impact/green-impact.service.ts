import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { LogGreenActionDto } from './dto/log-action.dto';

const BADGE_DEFINITIONS = [
  { id: 'first-action', label: 'First Action Logged', check: (actions: number) => actions >= 1 },
  { id: 'ten-actions', label: '10 Actions Logged', check: (actions: number) => actions >= 10 },
  { id: '100kg-milestone', label: '100kg CO2 Offset', check: (_actions: number, co2: number) => co2 >= 100 },
] as const;

@Injectable()
export class GreenImpactService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  /** Point formula — documented in the schema comment on GreenAction too:
   *  1 point per kg of CO2 offset, rounded. Kept in one place so it's easy
   *  to change later without touching every caller. */
  private pointsFor(co2OffsetKg: number): number {
    return Math.round(co2OffsetKg);
  }

  async logAction(userId: string, dto: LogGreenActionDto) {
    const action = await this.prisma.greenAction.create({
      data: {
        userId,
        type: dto.type,
        description: dto.description,
        co2OffsetKg: dto.co2OffsetKg,
      },
    });

    await this.activityService.log(
      userId,
      'GREEN_ACTION_LOGGED',
      `Logged ${dto.co2OffsetKg}kg CO2 offset (${dto.type.toLowerCase().replace('_', ' ')})`,
      { actionId: action.id },
    );

    return action;
  }

  async findMine(userId: string, limit = 20) {
    return this.prisma.greenAction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Powers the Green Impact Profile panel and top stat cards — every
   *  number here comes from a real query, not a hardcoded constant. */
  async stats(userId: string) {
    const [agg, actionsCount] = await Promise.all([
      this.prisma.greenAction.aggregate({
        where: { userId },
        _sum: { co2OffsetKg: true },
      }),
      this.prisma.greenAction.count({ where: { userId } }),
    ]);

    const totalCo2TrackedKg = agg._sum.co2OffsetKg ?? 0;
    const totalPoints = this.pointsFor(totalCo2TrackedKg);

    const badges = BADGE_DEFINITIONS.map((b) => ({
      id: b.id,
      label: b.label,
      earned: b.check(actionsCount, totalCo2TrackedKg),
    }));

    const ranking = await this.computeRanking(userId, totalPoints);

    return {
      totalCo2TrackedKg: Math.round(totalCo2TrackedKg * 100) / 100,
      totalPoints,
      actionsCount,
      badgesEarned: badges.filter((b) => b.earned).length,
      badgesTotal: badges.length,
      badges,
      ranking,
    };
  }

  /** #N ranking = 1 + how many other users have strictly more points.
   *  Computed with a raw aggregate per user rather than loading everyone
   *  into memory — fine at current scale, revisit with a materialized
   *  leaderboard table if the user base gets large enough for this to be
   *  slow. */
  private async computeRanking(userId: string, myPoints: number): Promise<number | null> {
    if (myPoints === 0) return null;

    const totals = await this.prisma.greenAction.groupBy({
      by: ['userId'],
      _sum: { co2OffsetKg: true },
    });

    const ahead = totals.filter(
      (t) => t.userId !== userId && this.pointsFor(t._sum.co2OffsetKg ?? 0) > myPoints,
    ).length;

    return ahead + 1;
  }
}
