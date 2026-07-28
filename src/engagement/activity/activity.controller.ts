import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { InternalServiceGuard } from '../../guards/internal-service.guard';
import { ActivityService } from './activity.service';
import { LogInternalActivityDto } from './dto/log-internal-activity.dto';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  findRecent(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;
    return this.activityService.findRecent(user.userId, take);
  }

  /** Powers the admin portal's Overview / recent-activity feed. */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findRecentAdmin(@Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 25;
    return this.activityService.findRecentAdmin(take);
  }

  /** Powers the admin portal's Overview page — same feed as /admin, but
   *  bucketed by tool/service (Academy, Green Impact, Mentor AI...). */
  @Get('admin/grouped')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findRecentAdminGrouped(@Query('perCategory') perCategory?: string) {
    const take = perCategory ? Math.min(parseInt(perCategory, 10) || 15, 30) : 15;
    return this.activityService.findRecentAdminGrouped(take);
  }
}

/**
 * Separate controller (not under ActivityController's class-level
 * JwtAuthGuard) for the standalone FastAPI tools — Market Research, Pitch
 * Deck Builder, Proposal Builder — to report activity back here after a
 * successful generation. They authenticate a shared secret, not a user's
 * JWT, since these are server-to-server calls.
 */
@Controller('activity/internal')
@UseGuards(InternalServiceGuard)
export class ActivityInternalController {
  constructor(private activityService: ActivityService) {}

  @Post('log')
  log(@Body() dto: LogInternalActivityDto) {
    return this.activityService.log(dto.userId, dto.type, dto.message, dto.metadata);
  }
}
