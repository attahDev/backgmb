import { Controller, Get, UseGuards } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@Controller('badges')
@UseGuards(JwtAuthGuard)
export class BadgesController {
  constructor(private badgesService: BadgesService) {}

  @Get('me')
  listMine(@CurrentUser() user: any) {
    return this.badgesService.listForUser(user.userId);
  }
}
