import { Injectable } from '@nestjs/common';
import { NotificationAudience, NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotifyOptions {
  category: NotificationCategory;
  title: string;
  body?: string;
  actionLabel?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every other engagement service calls this the same way it already calls
   * ActivityService.log() — one line at the point something happens — except
   * this is what actually powers the bell icon / Notifications page for the
   * affected user, not just their private activity history.
   */
  async notifyUser(userId: string, opts: NotifyOptions) {
    return this.prisma.notification.create({
      data: {
        audience: NotificationAudience.USER,
        userId,
        category: opts.category,
        title: opts.title,
        body: opts.body,
        actionLabel: opts.actionLabel,
        actionUrl: opts.actionUrl,
        metadata: opts.metadata as any,
      },
    });
  }

  /**
   * Broadcasts one Notification row with audience=ADMIN (userId left null —
   * it's not owned by one admin, every admin's feed reads the same rows).
   * This is the "notify admins about everything on the platform" hook: call
   * it from any service for events admins should see (new pending community
   * post, new signup, contact form, mentor request, etc).
   */
  async notifyAdmins(opts: NotifyOptions) {
    return this.prisma.notification.create({
      data: {
        audience: NotificationAudience.ADMIN,
        category: opts.category,
        title: opts.title,
        body: opts.body,
        actionLabel: opts.actionLabel,
        actionUrl: opts.actionUrl,
        metadata: opts.metadata as any,
      },
    });
  }

  async findForUser(userId: string, opts: { category?: NotificationCategory; unreadOnly?: boolean; limit?: number }) {
    return this.prisma.notification.findMany({
      where: {
        audience: NotificationAudience.USER,
        userId,
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async findForAdmin(opts: { category?: NotificationCategory; unreadOnly?: boolean; limit?: number }) {
    return this.prisma.notification.findMany({
      where: {
        audience: NotificationAudience.ADMIN,
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async unreadCountForUser(userId: string) {
    return this.prisma.notification.count({
      where: { audience: NotificationAudience.USER, userId, isRead: false },
    });
  }

  async unreadCountForAdmin() {
    return this.prisma.notification.count({
      where: { audience: NotificationAudience.ADMIN, isRead: false },
    });
  }

  /** Scoped strictly to this user's own USER-audience rows — can't touch
   *  someone else's, and can't touch ADMIN-audience rows either (those
   *  go through markReadAdmin/markAllReadAdmin, gated by RolesGuard at
   *  the controller). Deliberately doesn't take a role — see that guard
   *  for why req.user never carries one. */
  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, audience: NotificationAudience.USER, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { audience: NotificationAudience.USER, userId, isRead: false },
      data: { isRead: true },
    });
  }

  /** Admin feed is shared (one row per event, not one per admin) — so
   *  these aren't scoped to a particular admin's id, only gated by
   *  RolesGuard at the controller. Marking read is a shared action:
   *  once any admin dismisses it, it's read for all admins. */
  async markReadAdmin(id: string) {
    return this.prisma.notification.updateMany({
      where: { id, audience: NotificationAudience.ADMIN },
      data: { isRead: true },
    });
  }

  async markAllReadAdmin() {
    return this.prisma.notification.updateMany({
      where: { audience: NotificationAudience.ADMIN, isRead: false },
      data: { isRead: true },
    });
  }
}
