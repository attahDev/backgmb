import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { CareerPathsService } from './career-paths.service';
import { CreateCareerPathDto } from './dto/create-career-path.dto';
import { UpdateCareerPathDto } from './dto/update-career-path.dto';
import { AddCareerPathSkillDto } from './dto/add-career-path-skill.dto';
import { SetCareerGoalDto } from './dto/set-career-goal.dto';

@Controller('career-paths')
@UseGuards(JwtAuthGuard)
export class CareerPathsController {
  constructor(private careerPathsService: CareerPathsService) {}

  // ───────────────────────── Mentee-facing ─────────────────────────

  @Get()
  listActivePaths() {
    return this.careerPathsService.listActivePaths();
  }

  @Get('my-goal/readiness')
  getMyReadiness(@CurrentUser() user: any) {
    return this.careerPathsService.getMyReadiness(user.userId);
  }

  @Post('my-goal')
  setMyGoal(@CurrentUser() user: any, @Body() dto: SetCareerGoalDto) {
    return this.careerPathsService.setMyGoal(user.userId, dto.careerPathId);
  }

  // ───────────────────────── Admin ─────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminList() {
    return this.careerPathsService.adminList();
  }

  // Paths are AI-generated on first request rather than hand-entered.
  // This lets an admin force a fresh batch (e.g. after tuning the prompt).
  @Post('admin/regenerate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  regenerate() {
    return this.careerPathsService.regenerate();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCareerPathDto) {
    return this.careerPathsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCareerPathDto) {
    return this.careerPathsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.careerPathsService.remove(id);
  }

  @Post(':id/skills')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  addSkill(@Param('id') id: string, @Body() dto: AddCareerPathSkillDto) {
    return this.careerPathsService.addSkill(id, dto);
  }

  @Delete('skills/:skillId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeSkill(@Param('skillId') skillId: string) {
    return this.careerPathsService.removeSkill(skillId);
  }
}
