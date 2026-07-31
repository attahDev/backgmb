import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CreditGuard } from 'src/credits/credit.guard';
import { CreditFinalizeInterceptor } from 'src/credits/credit-finalize.interceptor';
import { RequireCredits } from 'src/credits/require-credits.decorator';
import { GreenAiService } from './green-ai.service';
import { GreenChatDto } from './dto/chat.dto';

@Controller('green-ai')
export class GreenAiController {
  constructor(private readonly greenAiService: GreenAiService) {}

  @UseGuards(JwtAuthGuard, CreditGuard)
  @UseInterceptors(CreditFinalizeInterceptor)
  @RequireCredits({
    service: 'green_ai_advisor',
    cost: 2,
    minTier: SubscriptionTier.EXECUTIVE,
  })
  @Get('advice')
  async getAdvice(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    const cards = await this.greenAiService.getAdvice(userId);
    return { cards };
  }

  @UseGuards(JwtAuthGuard, CreditGuard)
  @UseInterceptors(CreditFinalizeInterceptor)
  @RequireCredits({
    service: 'green_ai_advisor',
    cost: 2,
    minTier: SubscriptionTier.EXECUTIVE,
  })
  @Post('chat')
  async chat(@Body() dto: GreenChatDto, @Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.greenAiService.chat(userId, dto.message);
  }
}
