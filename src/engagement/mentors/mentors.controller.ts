import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { MentorsService } from './mentors.service';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { PromoteMentorDto } from './dto/promote-mentor.dto';
import { UpdateMenteeConnectionDto } from './dto/update-mentee-connection.dto';
import { SendMenteeMessageDto } from './dto/send-mentee-message.dto';
import { LogSkillDto } from './dto/log-skill.dto';
import { RequestSessionDto } from './dto/request-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateMentorSpotlightDto } from './dto/create-mentor-spotlight.dto';
import { UpdateMentorSpotlightDto } from './dto/update-mentor-spotlight.dto';

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

  @Get('spotlight/active')
  getActiveSpotlights() {
    return this.mentorsService.getActiveSpotlights();
  }

  // ───────────────────────── Mentor's own dashboard: "My Mentees" ─────────────────────────

  @Get('my-mentees')
  findMyMentees(@CurrentUser() user: any) {
    return this.mentorsService.findMyMentees(user.userId);
  }

  @Patch('mentees/:connectionId')
  updateMenteeConnection(
    @CurrentUser() user: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: UpdateMenteeConnectionDto,
  ) {
    return this.mentorsService.updateMenteeConnection(user.userId, connectionId, dto);
  }

  @Get('mentees/:connectionId/messages')
  getMenteeMessages(@CurrentUser() user: any, @Param('connectionId') connectionId: string) {
    return this.mentorsService.getMessages(connectionId, user.userId);
  }

  @Post('mentees/:connectionId/messages')
  sendMenteeMessage(
    @CurrentUser() user: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: SendMenteeMessageDto,
  ) {
    return this.mentorsService.sendMessage(connectionId, user.userId, dto.content);
  }

  // ───────────────────────── Skill logging ─────────────────────────

  @Get('mentees/:connectionId/skills')
  listSkillLogs(@CurrentUser() user: any, @Param('connectionId') connectionId: string) {
    return this.mentorsService.listSkillLogs(user.userId, connectionId);
  }

  @Post('mentees/:connectionId/skills')
  logSkill(
    @CurrentUser() user: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: LogSkillDto,
  ) {
    return this.mentorsService.logSkill(user.userId, connectionId, dto);
  }

  @Patch('skills/:skillLogId/confirm')
  confirmSkillLog(@CurrentUser() user: any, @Param('skillLogId') skillLogId: string) {
    return this.mentorsService.confirmSkillLog(user.userId, skillLogId);
  }

  // ───────────────────────── Sessions ─────────────────────────

  @Get('mentees/:connectionId/sessions')
  listSessions(@CurrentUser() user: any, @Param('connectionId') connectionId: string) {
    return this.mentorsService.listSessions(connectionId, user.userId);
  }

  @Post('mentees/:connectionId/sessions')
  requestSession(
    @CurrentUser() user: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: RequestSessionDto,
  ) {
    return this.mentorsService.requestSession(connectionId, user.userId, dto);
  }

  @Patch('sessions/:sessionId')
  updateSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.mentorsService.updateSession(sessionId, user.userId, dto);
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

  // ───────────────────────── Admin: promote/demote a real user to mentor ─────────────────────────

  @Post('promote')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  promote(@Body() dto: PromoteMentorDto) {
    return this.mentorsService.promoteToMentor(dto);
  }

  @Post('demote/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  demote(@Param('userId') userId: string) {
    return this.mentorsService.demoteMentor(userId);
  }

  // ───────────────────────── Admin: Mentor Spotlight ─────────────────────────

  @Get('spotlight/admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminListSpotlights() {
    return this.mentorsService.adminListSpotlights();
  }

  @Post('spotlight')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createSpotlight(@Body() dto: CreateMentorSpotlightDto) {
    return this.mentorsService.createSpotlight(dto);
  }

  @Patch('spotlight/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateSpotlight(@Param('id') id: string, @Body() dto: UpdateMentorSpotlightDto) {
    return this.mentorsService.updateSpotlight(id, dto);
  }

  @Delete('spotlight/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeSpotlight(@Param('id') id: string) {
    return this.mentorsService.removeSpotlight(id);
  }
}
