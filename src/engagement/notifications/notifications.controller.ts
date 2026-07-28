import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationCategory, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /** Powers the Notifications page + navbar bell for the logged-in user. */
  @Get()
  findMine(
    @CurrentUser() user: any,
    @Query('category') category?: NotificationCategory,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findForUser(user.userId, {
      category,
      unreadOnly: unread === 'true',
      limit: limit ? Math.min(parseInt(limit, 10) || 50, 100) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.notificationsService.unreadCountForUser(user.userId).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.userId);
  }

  // --- Admin feed — "everything on the platform" --------------------------
  // Shared across every admin (one ADMIN-audience row per event, not one
  // per admin). RolesGuard does its own DB role lookup — req.user from the
  // JWT payload only ever carries { userId, email }, never a role — so
  // these are separate routes rather than branching on user.role.

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAdmin(
    @Query('category') category?: NotificationCategory,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findForAdmin({
      category,
      unreadOnly: unread === 'true',
      limit: limit ? Math.min(parseInt(limit, 10) || 50, 100) : undefined,
    });
  }

  @Get('admin/unread-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  unreadCountAdmin() {
    return this.notificationsService.unreadCountForAdmin().then((count) => ({ count }));
  }

  @Patch('admin/:id/read')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  markReadAdmin(@Param('id') id: string) {
    return this.notificationsService.markReadAdmin(id);
  }

  @Patch('admin/read-all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  markAllReadAdmin() {
    return this.notificationsService.markAllReadAdmin();
  }
}
