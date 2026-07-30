/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MentorAiService } from './mentor-ai.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { ChatDto } from './dto/chat.dto';
import { Req } from '@nestjs/common';

@Controller('mentor-ai')
export class MentorAiController {
  constructor(private readonly mentorAiService: MentorAiService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  async chat(@Body() dto: ChatDto, @Req() req) {
    // console.log('REQ USER:', req.user);

    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;

    if (!userId) {
      throw new BadRequestException('User ID not found from token');
    }

    const result = await this.mentorAiService.chat(
      userId,
      dto.message,
      dto.chatId,
      dto.persona,
    );

    return {
      reply: result.reply,
      chatId: result.chatId,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('chats')
  async listChats(@Req() req) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.mentorAiService.listChats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('chats/:id')
  async getChat(@Param('id') id: string, @Req() req) {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    return this.mentorAiService.getChat(userId, id);
  }
}
