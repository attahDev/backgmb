import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { CommunityService } from './community.service';

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private communityService: CommunityService) {}

  @Get('spotlight')
  findSpotlight(@CurrentUser() user: any) {
    return this.communityService.findPublished(user?.userId);
  }

  @Post('spotlight/:id/like')
  like(@CurrentUser() user: any, @Param('id') id: string) {
    return this.communityService.like(user.userId, id);
  }

  @Delete('spotlight/:id/like')
  unlike(@CurrentUser() user: any, @Param('id') id: string) {
    return this.communityService.unlike(user.userId, id);
  }
}
