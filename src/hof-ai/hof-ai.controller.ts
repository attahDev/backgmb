import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { HofAiService } from './hof-ai.service';
import { HofChatDto } from './dto/chat.dto';

@Controller('hof-ai')
export class HofAiController {
  constructor(private readonly hofAiService: HofAiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  chat(@Body() dto: HofChatDto) {
    return this.hofAiService.chat(dto.message);
  }
}
