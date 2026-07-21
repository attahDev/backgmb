import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  findUpcoming(@Query('includeInactive') includeInactive?: string) {
    return this.eventsService.findUpcoming(includeInactive === 'true');
  }

  /** Powers the "My Events" dashboard — Upcoming / Attended / Saved tabs and
   *  the stats row above them. Replaces the hardcoded arrays that used to
   *  live directly in EventUI.tsx / EventStats.tsx. */
  @Get('mine')
  findMine(@CurrentUser() user: any) {
    return this.eventsService.findMine(user.userId);
  }

  @Post(':id/rsvp')
  rsvp(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.rsvp(user.userId, eventId);
  }

  @Post(':id/save')
  save(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.save(user.userId, eventId);
  }

  @Delete(':id/save')
  unsave(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.unsave(user.userId, eventId);
  }

  // ───────────────────────── Admin: event management ─────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createEvent(@Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.updateEvent(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeEvent(@Param('id') id: string) {
    return this.eventsService.removeEvent(id);
  }
}
