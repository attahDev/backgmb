import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { GreenImpactService } from './green-impact.service';
import { LogGreenActionDto } from './dto/log-action.dto';

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
}
