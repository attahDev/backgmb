import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { GreenProjectsService } from './green-projects.service';
import { CreateGreenProjectDto, UpdateGreenProjectDto } from './dto/green-project.dto';

@Controller('green-projects')
@UseGuards(JwtAuthGuard)
export class GreenProjectsController {
  constructor(private greenProjectsService: GreenProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.greenProjectsService.findAll(user.userId);
  }

  @Post(':id/support')
  support(@CurrentUser() user: any, @Param('id') id: string) {
    return this.greenProjectsService.support(user.userId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateGreenProjectDto) {
    return this.greenProjectsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateGreenProjectDto) {
    return this.greenProjectsService.update(id, dto);
  }

  @Patch(':id/raised-amount')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  setRaisedAmount(@Param('id') id: string, @Body('raisedAmountMinor') raisedAmountMinor: number) {
    return this.greenProjectsService.setRaisedAmount(id, raisedAmountMinor);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.greenProjectsService.remove(id);
  }
}
