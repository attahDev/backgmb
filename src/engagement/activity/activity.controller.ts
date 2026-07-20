import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ActivityService } from './activity.service';

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
}
