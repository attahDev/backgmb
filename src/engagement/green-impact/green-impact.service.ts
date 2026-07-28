import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { BadgesService } from '../badges/badges.service';
import { LogGreenActionDto } from './dto/log-action.dto';
import { CreateClimateReportDto, UpdateClimateReportDto } from './dto/climate-report.dto';
import { ClimateDataService } from './climate-data.service';

const BADGE_DEFINITIONS = [
  {
    id: 'first-action',
    label: 'First Action Logged',
    description: 'Log your first green action',
    target: 1,
    metric: 'actions' as const,
  },
  {
    id: 'ten-actions',
    label: '10 Actions Logged',
    description: 'Log 10 green actions',
    target: 10,
    metric: 'actions' as const,
  },
  {
    id: '100kg-milestone',
    label: '100kg CO2 Offset',
    description: 'Offset 100kg of CO2',
    target: 100,
    metric: 'co2' as const,
  },
] as const;

// Rank threshold below which the "Green Champion" badge unlocks on the
// leaderboard — matches the copy on the leaderboard card.
const GREEN_CHAMPION_RANK_THRESHOLD = 25;

// Average kg of CO2 a young tree absorbs per year — used to translate
// logged TREE_PLANTING offset totals into an estimated tree count for the
// "Trees Planted" stat, since users log kg offset, not a tree count.
const KG_CO2_PER_TREE_PER_YEAR = 21;

@Injectable()
export class GreenImpactService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private climateData: ClimateDataService,
    private badgesService: BadgesService,
  ) {}

  /** Point formula — documented in the schema comment on GreenAction too:
   *  1 point per kg of CO2 offset, rounded. Kept in one place so it's easy
   *  to change later without touching every caller. */
  private pointsFor(co2OffsetKg: number): number {
    return Math.round(co2OffsetKg);
  }

  /** Green Points -> Green Exchange wallet balance. 1 point = 0.1 balance. */
  private balanceFor(points: number): number {
    return Math.round(points * 0.1 * 100) / 100;
  }

  async logAction(userId: string, dto: LogGreenActionDto) {
    const action = await this.prisma.greenAction.create({
      data: {
        userId,
        type: dto.type,
        description: dto.description,
        co2OffsetKg: dto.co2OffsetKg,
        area: dto.area,
      },
    });

    await this.activityService.log(
      userId,
      'GREEN_ACTION_LOGGED',
      `Logged ${dto.co2OffsetKg}kg CO2 offset (${dto.type.toLowerCase().replace('_', ' ')})`,
      { actionId: action.id },
    );
    await this.badgesService.evaluate(userId, 'GREEN_ACTIONS_LOGGED');
    await this.badgesService.evaluate(userId, 'GREEN_CO2_KG');

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
    const balance = this.balanceFor(totalPoints);

    const badges = BADGE_DEFINITIONS.map((b) => {
      const current = b.metric === 'actions' ? actionsCount : totalCo2TrackedKg;
      const progress = Math.min(100, Math.round((current / b.target) * 100));
      const earned = current >= b.target;
      return {
        id: b.id,
        label: b.label,
        description: b.description,
        earned,
        progress,
        current: Math.round(current * 100) / 100,
        target: b.target,
        // e.g. remaining=7 -> "Log 7 more actions" / "Offset 34.5kg more CO2"
        remaining: earned ? 0 : Math.round((b.target - current) * 100) / 100,
      };
    });

    const ranking = await this.computeRanking(userId, totalPoints);

    return {
      totalCo2TrackedKg: Math.round(totalCo2TrackedKg * 100) / 100,
      totalPoints,
      balance,
      pointsToBalanceRate: 0.1,
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

  /** Real leaderboard: every user's total points, ranked, joined against
   *  their profile for a display name. No fake companies — if nobody has
   *  logged an action yet, the list is genuinely empty. */
  async leaderboard(userId: string, limit = 10) {
    const totals = await this.prisma.greenAction.groupBy({
      by: ['userId'],
      _sum: { co2OffsetKg: true },
    });

    const ranked = totals
      .map((t) => ({
        userId: t.userId,
        points: this.pointsFor(t._sum.co2OffsetKg ?? 0),
      }))
      .filter((t) => t.points > 0)
      .sort((a, b) => b.points - a.points);

    const users = await this.prisma.user.findMany({
      where: { id: { in: ranked.map((r) => r.userId) } },
      select: { id: true, firstname: true, lastname: true, organization: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const top = ranked.slice(0, limit).map((entry, index) => {
      const user = userMap.get(entry.userId);
      return {
        rank: index + 1,
        userId: entry.userId,
        // Companies register with an org name; fall back to first/last
        // name for individual accounts that left it blank.
        displayName:
          user?.organization?.trim() ||
          [user?.firstname, user?.lastname].filter(Boolean).join(' ') ||
          'GMBTE Member',
        points: entry.points,
        isCurrentUser: entry.userId === userId,
      };
    });

    const myEntry = ranked.find((r) => r.userId === userId);
    const myRank = myEntry ? ranked.indexOf(myEntry) + 1 : null;

    return {
      top,
      totalRankedUsers: ranked.length,
      me: {
        rank: myRank,
        points: myEntry?.points ?? 0,
      },
      greenChampionRankThreshold: GREEN_CHAMPION_RANK_THRESHOLD,
      greenChampionUnlocked: myRank !== null && myRank <= GREEN_CHAMPION_RANK_THRESHOLD,
    };
  }

  /** Real per-borough breakdown, built from whatever areas users have
   *  actually tagged their logged actions with. Boroughs nobody has
   *  logged against yet simply don't appear — no placeholder rows. */
  private async impactByArea() {
    const rows = await this.prisma.greenAction.groupBy({
      by: ['area'],
      where: { area: { not: null } },
      _sum: { co2OffsetKg: true },
    });

    return rows
      .map((r) => ({
        area: r.area as string,
        co2OffsetKg: Math.round((r._sum.co2OffsetKg ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.co2OffsetKg - a.co2OffsetKg);
  }

  /** Real monthly offset totals across all users for the last N months —
   *  the "Offset" line on the CO2 Emissions vs Offset chart. */
  private async offsetByMonth(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const actions = await this.prisma.greenAction.findMany({
      where: { createdAt: { gte: since } },
      select: { co2OffsetKg: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-GB', { month: 'short' });
      buckets.set(key, 0);
    }

    for (const a of actions) {
      const key = a.createdAt.toLocaleString('en-GB', { month: 'short' });
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + a.co2OffsetKg);
      }
    }

    return Array.from(buckets.entries()).map(([month, kg]) => ({
      month,
      offsetKg: Math.round(kg * 100) / 100,
    }));
  }

  /** Real tree count, estimated from TREE_PLANTING logs (users log kg CO2
   *  offset, not a raw tree count) rather than a hardcoded figure. */
  private async treesPlanted(): Promise<number> {
    const agg = await this.prisma.greenAction.aggregate({
      where: { type: 'TREE_PLANTING' },
      _sum: { co2OffsetKg: true },
    });
    const kg = agg._sum.co2OffsetKg ?? 0;
    return Math.round(kg / KG_CO2_PER_TREE_PER_YEAR);
  }

  /** Powers the Climate Insights & Data panel. Regional temperature and
   *  renewable-mix figures come live from Open-Meteo / the UK Carbon
   *  Intensity API (both free, keyless). Trees planted, per-borough
   *  impact, and the offset side of the trend chart come from our own
   *  users' real logged actions. Any provider that fails returns null for
   *  its own field instead of taking down the rest of the response. */
  async climateInsights() {
    const [avgTemperatureRiseC, renewableEnergyPct, emissionsByMonth, offsetByMonth, byArea, treesPlanted] =
      await Promise.all([
        this.climateData.temperatureRiseC(),
        this.climateData.renewableEnergyPct(),
        this.climateData.emissionsByMonth(6),
        this.offsetByMonth(6),
        this.impactByArea(),
        this.treesPlanted(),
      ]);

    const trend = emissionsByMonth.map((e, i) => ({
      month: e.month,
      emissionsGCO2PerKWh: e.gCO2PerKWh,
      offsetKg: offsetByMonth[i]?.offsetKg ?? 0,
    }));

    return {
      avgTemperatureRiseC,
      renewableEnergyPct,
      treesPlanted,
      trend,
      impactByArea: byArea,
      reports: await this.listActiveReports(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ───────────────────────── Admin: climate reports ─────────────────────────
  // Same "admin-uploaded, no hardcoded content" convention as Courses/Events —
  // the two report cards on the Climate Insights panel used to be a fixed
  // array in the frontend; they're a real table now.

  async listActiveReports() {
    return this.prisma.climateReport.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAllReports() {
    return this.prisma.climateReport.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createReport(dto: CreateClimateReportDto) {
    return this.prisma.climateReport.create({ data: dto });
  }

  async updateReport(id: string, dto: UpdateClimateReportDto) {
    return this.prisma.climateReport.update({ where: { id }, data: dto });
  }

  async removeReport(id: string) {
    return this.prisma.climateReport.delete({ where: { id } });
  }
}
