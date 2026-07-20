import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { MentorsService } from './mentors.service';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';

@Controller('mentors')
@UseGuards(JwtAuthGuard)
export class MentorsController {
  constructor(private mentorsService: MentorsService) {}

  @Get()
  findAll(@Query('skill') skill?: string) {
    return this.mentorsService.findAll(skill);
  }

  @Get('my-mentors')
  findMyMentors(@CurrentUser() user: any) {
    return this.mentorsService.findMyMentors(user.userId);
  }

  @Get('stats')
  stats(@CurrentUser() user: any) {
    return this.mentorsService.stats(user.userId);
  }

  @Post(':id/connect')
  connect(@CurrentUser() user: any, @Param('id') mentorId: string) {
    return this.mentorsService.connect(user.userId, mentorId);
  }

  // ───────────────────────── Admin: mentor directory management ─────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createMentor(@Body() dto: CreateMentorDto) {
    return this.mentorsService.createMentor(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateMentor(@Param('id') id: string, @Body() dto: UpdateMentorDto) {
    return this.mentorsService.updateMentor(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeMentor(@Param('id') id: string) {
    return this.mentorsService.removeMentor(id);
  }
}
