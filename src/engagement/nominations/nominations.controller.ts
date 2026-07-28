import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { NominationsService } from './nominations.service';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { UpdateNominationStatusDto } from './dto/update-nomination-status.dto';

@Controller('nominations')
@UseGuards(JwtAuthGuard)
export class NominationsController {
  constructor(private nominationsService: NominationsService) {}

  /** Public "Recent Nominations" feed — approved only. */
  @Get()
  findApproved() {
    return this.nominationsService.findApproved();
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateNominationDto) {
    return this.nominationsService.create(user.userId, dto);
  }

  // ───────────────────────── Admin: nomination review ─────────────────────────

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllAdmin(@Query('status') status?: string) {
    return this.nominationsService.findAllAdmin(status);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  setStatus(@Param('id') id: string, @Body() dto: UpdateNominationStatusDto) {
    return this.nominationsService.setStatus(id, dto.status);
  }
}
