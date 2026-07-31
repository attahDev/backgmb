import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { OptionalJwtAuthGuard } from 'src/guards/optional-jwt-auth.guard';
import { CreditGuard } from 'src/credits/credit.guard';
import { CreditFinalizeInterceptor } from 'src/credits/credit-finalize.interceptor';
import { RequireCredits } from 'src/credits/require-credits.decorator';
import { HofAiService } from './hof-ai.service';
import { HofChatDto } from './dto/chat.dto';

@Controller('hof-ai')
export class HofAiController {
  constructor(private readonly hofAiService: HofAiService) {}

  // Optional auth: the public Hall of Fame site has no login of its own —
  // most visitors hit this with no token at all. When one is present
  // (embedded via gmbtefro with a gmbte_token), the chat gets logged to
  // that user's activity; otherwise it just answers anonymously.
  //
  // Credit gating is `optional: true` to match: anonymous requests pass
  // through free (there's no user to charge). Logged-in requests still get
  // checked against the original Executive/1-credit spec below — worth a
  // second look product-side, since that means a logged-in user below
  // Executive tier is worse off here than an anonymous visitor.
  @UseGuards(OptionalJwtAuthGuard, CreditGuard)
  @UseInterceptors(CreditFinalizeInterceptor)
  @RequireCredits({
    service: 'hof_ai',
    cost: 1,
    minTier: SubscriptionTier.EXECUTIVE,
    optional: true,
  })
  @Post('chat')
  chat(@Body() dto: HofChatDto, @Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.hofAiService.chat(dto.message, userId);
  }
}
