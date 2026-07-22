import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { GreenImpactService } from './green-impact.service';
import { LogGreenActionDto } from './dto/log-action.dto';
import { CreateClimateReportDto, UpdateClimateReportDto } from './dto/climate-report.dto';

@Controller('green-impact')
@UseGuards(JwtAuthGuard)
export class GreenImpactController {
  constructor(private greenImpactService: GreenImpactService) {}

  @Post('actions')
  logAction(@CurrentUser() user: any, @Body() dto: LogGreenActionDto) {
    return this.greenImpactService.logAction(user.userId, dto);
  }

  @Get('actions/mine')
  findMine(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.greenImpactService.findMine(user.userId, take);
  }

  @Get('stats')
  stats(@CurrentUser() user: any) {
    return this.greenImpactService.stats(user.userId);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;
    return this.greenImpactService.leaderboard(user.userId, take);
  }

  // Regional/city-wide data, not user-specific, but still gated behind
  // auth like the rest of the dashboard. Includes the active report cards.
  @Get('climate-insights')
  climateInsights() {
    return this.greenImpactService.climateInsights();
  }

  // ───────────────────────── Admin: climate reports ─────────────────────────

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listAllReports() {
    return this.greenImpactService.listAllReports();
  }

  @Post('reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createReport(@Body() dto: CreateClimateReportDto) {
    return this.greenImpactService.createReport(dto);
  }

  @Patch('reports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateReport(@Param('id') id: string, @Body() dto: UpdateClimateReportDto) {
    return this.greenImpactService.updateReport(id, dto);
  }

  @Delete('reports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeReport(@Param('id') id: string) {
    return this.greenImpactService.removeReport(id);
  }
}
