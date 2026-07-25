import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Approved community posts are meant to be short-lived — this deletes them
 * (and their comments/likes, via onDelete: Cascade) once they've been live
 * for COMMUNITY_POST_TTL_DAYS days. Defaults to 2; set to 1 on Render if
 * you want same-day-plus-one instead. Runs once an hour so the actual
 * lifetime is TTL days ± an hour, not exactly midnight-aligned.
 *
 * Does NOT delete the underlying S3 image object — only the DB row. Old
 * images will accumulate in the bucket; add a lifecycle rule on the bucket
 * itself (or a follow-up cleanup job) if that needs to be reclaimed too.
 */
@Injectable()
export class CommunityCleanupService {
  private readonly logger = new Logger(CommunityCleanupService.name);

  constructor(private prisma: PrismaService) {}

  private get ttlDays(): number {
    const raw = Number(process.env.COMMUNITY_POST_TTL_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : 2;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpiredPosts() {
    const cutoff = new Date(Date.now() - this.ttlDays * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.spotlightStory.deleteMany({
      where: {
        status: PostStatus.APPROVED,
        approvedAt: { lte: cutoff },
      },
    });

    if (count > 0) {
      this.logger.log(`Deleted ${count} approved community post(s) older than ${this.ttlDays}d`);
    }
  }
}
