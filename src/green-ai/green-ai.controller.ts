import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { GreenAiService } from './green-ai.service';
import { GreenChatDto } from './dto/chat.dto';

@Controller('green-ai')
export class GreenAiController {
  constructor(private readonly greenAiService: GreenAiService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  @Get('advice')
  async getAdvice(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    const cards = await this.greenAiService.getAdvice(userId);
    return { cards };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  async chat(@Body() dto: GreenChatDto, @Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.greenAiService.chat(userId, dto.message);
  }
}
