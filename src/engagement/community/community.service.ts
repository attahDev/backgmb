import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PostStatus, NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';

const AVATAR_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'];

@Injectable()
export class CommunityService {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * The community feed. A mix of admin-authored editorial spotlights
   * (userId null, status defaults APPROVED) and user-submitted shoutouts
   * that have cleared moderation (status APPROVED). PENDING/REJECTED posts
   * never show up here — only in the author's own `findMine()` and the
   * admin queue.
   *
   * hasLiked reflects the *calling* user's own SpotlightLike row, so the
   * frontend can render the heart as filled/unfilled correctly per user
   * instead of just showing the raw count.
   */
  async findFeed(userId: string | undefined, limit = 30) {
    const stories = await this.prisma.spotlightStory.findMany({
      where: { status: PostStatus.APPROVED },
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

  /** A user's own submissions regardless of status, so they can see a post
   *  is still pending or was rejected — not just have it silently vanish. */
  async findMine(userId: string) {
    return this.prisma.spotlightStory.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });
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

  /** A user posting their own shoutout — optionally with a photo (e.g. from
   *  an event). Always created PENDING; only shows up in the public feed
   *  once an admin approves it. Fires a notification both ways: to the
   *  author (so they know it's in review, not just silently missing from
   *  the feed) and to admins (so the approval queue doesn't rely on an
   *  admin remembering to check it). */
  async createPost(
    userId: string,
    dto: { title: string; description: string },
    file?: Express.Multer.File,
  ) {
    if (!dto.title?.trim() || !dto.description?.trim()) {
      throw new BadRequestException('Title and description are required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await this.uploadsService.uploadCommunityImage(file);
      imageUrl = uploaded.url;
    }

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const post = await this.prisma.spotlightStory.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        authorName: `${user.firstname} ${user.lastname}`,
        authorRole: user.organization || 'Community Member',
        avatarColor,
        imageUrl,
        userId: userId,
        status: PostStatus.PENDING,
      },
    });

    await this.notificationsService.notifyUser(userId, {
      category: NotificationCategory.COMMUNITY,
      title: 'Your post is awaiting approval',
      body: `"${post.title}" will appear in the community feed once an admin reviews it.`,
      metadata: { storyId: post.id },
    });

    await this.notificationsService.notifyAdmins({
      category: NotificationCategory.COMMUNITY,
      title: 'New community post pending approval',
      body: `${post.authorName} submitted "${post.title}".`,
      actionLabel: 'Review',
      actionUrl: '/dashboard/admin/community',
      metadata: { storyId: post.id, userId },
    });

    return post;
  }

  // --- Comments -----------------------------------------------------------

  /** Comments are only readable/postable on a live (APPROVED) post — a
   *  pending or rejected post isn't public yet, so its comment thread
   *  shouldn't be either. */
  async findComments(storyId: string) {
    const post = await this.prisma.spotlightStory.findUnique({ where: { id: storyId } });
    if (!post || post.status !== PostStatus.APPROVED) throw new NotFoundException('Post not found');

    return this.prisma.comment.findMany({
      where: { storyId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { firstname: true, lastname: true } } },
    });
  }

  async addComment(userId: string, storyId: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Comment cannot be empty');

    const post = await this.prisma.spotlightStory.findUnique({ where: { id: storyId } });
    if (!post || post.status !== PostStatus.APPROVED) throw new NotFoundException('Post not found');

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { storyId, userId: userId, content: content.trim() },
        include: { author: { select: { firstname: true, lastname: true } } },
      }),
      this.prisma.spotlightStory.update({ where: { id: storyId }, data: { comments: { increment: 1 } } }),
    ]);

    // Let the post's author know someone engaged with their shoutout —
    // skip it if they're commenting on their own post.
    if (post.authorId && post.authorId !== userId) {
      await this.notificationsService.notifyUser(post.authorId, {
        category: NotificationCategory.COMMUNITY,
        title: `New comment on "${post.title}"`,
        actionLabel: 'View',
        actionUrl: '/dashboard/community',
        metadata: { storyId },
      });
    }

    return comment;
  }

  /** Own comment only — deleting someone else's requires the separate
   *  admin-guarded route below (req.user from the JWT never carries a
   *  role to branch on here — see RolesGuard). */
  async deleteOwnComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not your comment');

    await this.prisma.$transaction([
      this.prisma.comment.delete({ where: { id: commentId } }),
      this.prisma.spotlightStory.update({
        where: { id: comment.storyId },
        data: { comments: { decrement: 1 } },
      }),
    ]);

    return { removed: true };
  }

  /** Admin cleanup — can remove any comment, gated by RolesGuard at the
   *  controller, not by trusting a role field on the request. */
  async deleteCommentAdmin(commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.prisma.$transaction([
      this.prisma.comment.delete({ where: { id: commentId } }),
      this.prisma.spotlightStory.update({
        where: { id: comment.storyId },
        data: { comments: { decrement: 1 } },
      }),
    ]);

    return { removed: true };
  }

  // --- Admin moderation -----------------------------------------------------

  async findPending() {
    return this.prisma.spotlightStory.findMany({
      where: { status: PostStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(storyId: string) {
    const post = await this.prisma.spotlightStory.update({
      where: { id: storyId },
      data: { status: PostStatus.APPROVED },
    });

    if (post.authorId) {
      await this.notificationsService.notifyUser(post.authorId, {
        category: NotificationCategory.COMMUNITY,
        title: `Your post is live: "${post.title}"`,
        body: 'It now shows up in the community feed for everyone.',
        actionLabel: 'View Post',
        actionUrl: '/dashboard/community',
        metadata: { storyId },
      });
    }

    return post;
  }

  async reject(storyId: string, reason?: string) {
    const post = await this.prisma.spotlightStory.update({
      where: { id: storyId },
      data: { status: PostStatus.REJECTED },
    });

    if (post.authorId) {
      await this.notificationsService.notifyUser(post.authorId, {
        category: NotificationCategory.COMMUNITY,
        title: `Your post wasn't approved: "${post.title}"`,
        body: reason || "It didn't meet the community guidelines.",
        metadata: { storyId },
      });
    }

    return post;
  }
}
