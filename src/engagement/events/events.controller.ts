import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateCommunityEventDto } from './dto/create-community-event.dto';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /** Public — the marketing site's Events page calls this unauthenticated. */
  @Get()
  findUpcoming(@Query('includeInactive') includeInactive?: string) {
    return this.eventsService.findUpcoming(includeInactive === 'true');
  }

  /** "View All Events" — public, upcoming/non-completed archive for the
   *  public Events page's expand action. */
  @Get('all')
  findAllArchive() {
    return this.eventsService.findAll();
  }

  /** Public — "Our Past Events / Highlights from Previous Editions" on the
   *  public Events page. */
  @Get('past')
  findPastEvents() {
    return this.eventsService.findPastEvents();
  }

  /** Powers the "My Events" dashboard — Upcoming / Attended / Saved tabs and
   *  the stats row above them. Replaces the hardcoded arrays that used to
   *  live directly in EventUI.tsx / EventStats.tsx. */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: any) {
    return this.eventsService.findMine(user.userId);
  }

  /** The current user's own "Host an Event" submissions — PENDING/APPROVED/
   *  REJECTED — so a member can track status without them being publicly
   *  visible. Two path segments, so no ordering hazard with ':id' below,
   *  but kept up here with the other static GETs for readability. */
  @Get('community/mine')
  @UseGuards(JwtAuthGuard)
  findMySubmissions(@CurrentUser() user: any) {
    return this.eventsService.findMySubmissions(user.userId);
  }

  /** Single event, for a detail modal/page. Public — same reasoning as
   *  findUpcoming above. Registered after the static 'all'/'past'/'mine'
   *  paths above so those aren't swallowed as :id values. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  /** "Host an Event" — any authenticated member can submit one. No
   *  RolesGuard: this is deliberately open to everyone, unlike admin
   *  createEvent() below. Multipart: same fields as CreateCommunityEventDto
   *  plus an optional `image` file — matches community.controller.ts's
   *  createPost pattern rather than binding a DTO straight off multipart
   *  body, since `tags` needs manual parsing either way. Always lands
   *  PENDING — see EventsService. */
  @Post('community')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 15 * 1024 * 1024 } }))
  submitCommunityEvent(
    @CurrentUser() user: any,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('location') location: string,
    @Body('mode') mode: string,
    @Body('link') link: string,
    @Body('startsAt') startsAt: string,
    @Body('endsAt') endsAt: string,
    @Body('tags') tagsText: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!title?.trim() || !startsAt) {
      throw new BadRequestException('Title and start date are required');
    }

    const dto: CreateCommunityEventDto = {
      title,
      description: description || undefined,
      location: location || undefined,
      mode: mode || undefined,
      link: link || undefined,
      startsAt,
      endsAt: endsAt || undefined,
      tags: tagsText
        ? tagsText.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };

    return this.eventsService.submitCommunityEvent(user.userId, dto, file);
  }

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  rsvp(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.rsvp(user.userId, eventId);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  save(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.save(user.userId, eventId);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  unsave(@CurrentUser() user: any, @Param('id') eventId: string) {
    return this.eventsService.unsave(user.userId, eventId);
  }

  // ───────────────────────── Admin: event management ─────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createEvent(@Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.updateEvent(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeEvent(@Param('id') id: string) {
    return this.eventsService.removeEvent(id);
  }

  // ───────────────────────── Admin: community event moderation ─────────────────────────

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findPendingSubmissions() {
    return this.eventsService.findPendingSubmissions();
  }

  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  approveCommunityEvent(@Param('id') id: string) {
    return this.eventsService.approveCommunityEvent(id);
  }

  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  rejectCommunityEvent(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.eventsService.rejectCommunityEvent(id, reason);
  }

  /** Admin writes up "what happened" after an event — powers the public
   *  Highlights section. Multipart: summary/speakers/achievements as text
   *  fields (speakers/achievements comma-separated, same convention as
   *  tags), keepGallery as a JSON-stringified array of URLs the admin left
   *  in place, plus any number of new `gallery` image files. */
  @Patch('admin/:id/recap')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('gallery', 10, { limits: { fileSize: 15 * 1024 * 1024 } }))
  updateRecap(
    @Param('id') id: string,
    @Body('summary') summary: string,
    @Body('speakers') speakersText: string,
    @Body('achievements') achievementsText: string,
    @Body('keepGallery') keepGalleryJson: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let keepGallery: string[] = [];
    try {
      keepGallery = keepGalleryJson ? JSON.parse(keepGalleryJson) : [];
    } catch {
      keepGallery = [];
    }

    return this.eventsService.updateRecap(
      id,
      {
        summary: summary || undefined,
        speakers: speakersText ? speakersText.split(',').map((s) => s.trim()).filter(Boolean) : [],
        achievements: achievementsText
          ? achievementsText.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        keepGallery,
      },
      files ?? [],
    );
  }
}
