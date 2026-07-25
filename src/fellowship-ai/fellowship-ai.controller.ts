import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { FellowshipAiService } from './fellowship-ai.service';
import { FellowshipChatDto } from './dto/chat.dto';

@Controller('fellowship-ai')
export class FellowshipAiController {
  constructor(private readonly fellowshipAiService: FellowshipAiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  chat(@Body() dto: FellowshipChatDto) {
    return this.fellowshipAiService.chat(dto.message);
  }
}
