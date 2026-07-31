import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /** Used by proactive balance checks before a credit-charging action —
   *  e.g. an Academy course card showing "Enroll (80 credits)" and a
   *  pay-confirmation step before the enroll request is ever attempted. */
  @UseGuards(JwtAuthGuard)
  @Get('balance')
  getBalance(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.creditsService.getBalance(userId);
  }
}
