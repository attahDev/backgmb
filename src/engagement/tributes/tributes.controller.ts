import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { TributesService } from './tributes.service';
import { CreateTributeDto } from './dto/create-tribute.dto';

@Controller('tributes')
@UseGuards(JwtAuthGuard)
export class TributesController {
  constructor(private tributesService: TributesService) {}

  @Get()
  findAll() {
    return this.tributesService.findAll();
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTributeDto) {
    return this.tributesService.create(user.userId, dto);
  }

  /** Owner can remove their own tribute. */
  @Delete(':id')
  removeOwn(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tributesService.removeOwn(user.userId, id);
  }

  /** Admin moderation — remove anyone's tribute. */
  @Delete(':id/admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeAsAdmin(@Param('id') id: string) {
    return this.tributesService.remove(id);
  }
}
