import { Injectable } from '@nestjs/common';
import { NotificationAudience, NotificationCategory, UserRole } from '@prisma/client';
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

  /** Scoped to the caller — an admin can't mark a user's notification read
   *  and vice versa, since each feed only ever queries its own audience. */
  async markRead(id: string, caller: { userId: string; role?: UserRole | null }) {
    const isAdmin = caller.role === UserRole.ADMIN;
    return this.prisma.notification.updateMany({
      where: isAdmin
        ? { id, audience: NotificationAudience.ADMIN }
        : { id, audience: NotificationAudience.USER, userId: caller.userId },
      data: { isRead: true },
    });
  }

  async markAllRead(caller: { userId: string; role?: UserRole | null }) {
    const isAdmin = caller.role === UserRole.ADMIN;
    return this.prisma.notification.updateMany({
      where: isAdmin
        ? { audience: NotificationAudience.ADMIN, isRead: false }
        : { audience: NotificationAudience.USER, userId: caller.userId, isRead: false },
      data: { isRead: true },
    });
  }
}
