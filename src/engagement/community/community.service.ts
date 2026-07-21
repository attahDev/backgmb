import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin-curated success stories. Unlike mentors/courses/events, these are
   * not meant to be per-user activity — they're editorial content — so they
   * still come from the database (not source code) but there's no per-user
   * ownership. Manage them through Prisma Studio or an admin endpoint later.
   *
   * hasLiked reflects the *calling* user's own SpotlightLike row, so the
   * frontend can render the heart as filled/unfilled correctly per user
   * instead of just showing the raw count.
   */
  async findPublished(userId: string | undefined, limit = 10) {
    const stories = await this.prisma.spotlightStory.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (!userId || stories.length === 0) {
      return stories.map((s) => ({ ...s, hasLiked: false }));
    }

    const likedRows = await this.prisma.spotlightLike.findMany({
      where: { userId, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    const likedIds = new Set(likedRows.map((r) => r.storyId));

    return stories.map((s) => ({ ...s, hasLiked: likedIds.has(s.id) }));
  }

  /** Toggle behaviour lives in the controller (POST = like, DELETE =
   *  unlike) — this just does the write + keeps the denormalized `likes`
   *  count in sync, the same pattern Course.totalModules uses. */
  async like(userId: string, storyId: string) {
    const story = await this.prisma.spotlightStory.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');

    const existing = await this.prisma.spotlightLike.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });
    if (existing) return { likes: story.likes, hasLiked: true };

    const [, updated] = await this.prisma.$transaction([
      this.prisma.spotlightLike.create({ data: { userId, storyId } }),
      this.prisma.spotlightStory.update({
        where: { id: storyId },
        data: { likes: { increment: 1 } },
      }),
    ]);

    return { likes: updated.likes, hasLiked: true };
  }

  async unlike(userId: string, storyId: string) {
    const existing = await this.prisma.spotlightLike.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });
    if (!existing) {
      const story = await this.prisma.spotlightStory.findUnique({ where: { id: storyId } });
      return { likes: story?.likes ?? 0, hasLiked: false };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.spotlightLike.delete({ where: { userId_storyId: { userId, storyId } } }),
      this.prisma.spotlightStory.update({
        where: { id: storyId },
        data: { likes: { decrement: 1 } },
      }),
    ]);

    return { likes: updated.likes, hasLiked: false };
  }
}
