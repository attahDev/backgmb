import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

/** Attendance.status values. Free-form string column in the DB (no enum),
 *  so keep the allowed values centralised here. */
export const ATTENDANCE_STATUS = {
  SAVED: 'SAVED',
  REGISTERED: 'REGISTERED',
} as const;

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findUpcoming() {
    return this.prisma.event.findMany({
      where: { isActive: true, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
  }

  /** Powers the Events dashboard tabs (Upcoming / Attended / Saved) and the
   *  stats row — replaces the hardcoded arrays that used to live in
   *  EventUI.tsx / EventStats.tsx. "Attended" isn't a stored status: it's a
   *  REGISTERED attendance whose event has already ended, computed here so
   *  nothing has to flip a flag after the fact. */
  async findMine(userId: string) {
    const attendance = await this.prisma.eventAttendance.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { event: { startsAt: 'asc' } },
    });

    const now = new Date();
    const upcoming = attendance.filter(
      (a) => a.status === ATTENDANCE_STATUS.REGISTERED && a.event.startsAt >= now,
    );
    const attended = attendance.filter(
      (a) => a.status === ATTENDANCE_STATUS.REGISTERED && a.event.startsAt < now,
    );
    const saved = attendance.filter((a) => a.status === ATTENDANCE_STATUS.SAVED);

    return { upcoming, attended, saved };
  }

  async rsvp(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventAttendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (existing) {
      if (existing.status === ATTENDANCE_STATUS.REGISTERED) {
        throw new ConflictException('Already registered for this event');
      }
      // Was SAVED — upgrade to REGISTERED instead of a duplicate row
      // (unique constraint is on [userId, eventId], one row per pair).
      const attendance = await this.prisma.eventAttendance.update({
        where: { userId_eventId: { userId, eventId } },
        data: { status: ATTENDANCE_STATUS.REGISTERED },
        include: { event: true },
      });
      await this.activityService.log(userId, 'EVENT_RSVP', `Registered for ${event.title}`, { eventId });
      return attendance;
    }

    const attendance = await this.prisma.eventAttendance.create({
      data: { userId, eventId, status: ATTENDANCE_STATUS.REGISTERED },
      include: { event: true },
    });

    await this.activityService.log(
      userId,
      'EVENT_RSVP',
      `Registered for ${event.title}`,
      { eventId },
    );

    return attendance;
  }

  /** Bookmark an event without registering attendance. Does not downgrade
   *  an existing REGISTERED row — saving something you're already going to
   *  shouldn't un-register you. */
  async save(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventAttendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existing) return existing;

    return this.prisma.eventAttendance.create({
      data: { userId, eventId, status: ATTENDANCE_STATUS.SAVED },
      include: { event: true },
    });
  }

  async unsave(userId: string, eventId: string) {
    const existing = await this.prisma.eventAttendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!existing) return { removed: false };
    if (existing.status !== ATTENDANCE_STATUS.SAVED) {
      throw new ForbiddenException('Cannot unsave an event you are registered for — cancel the RSVP instead');
    }
    await this.prisma.eventAttendance.delete({ where: { userId_eventId: { userId, eventId } } });
    return { removed: true };
  }

  // ───────────────────────── Admin: event management ─────────────────────────

  async createEvent(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateEvent(id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && { endsAt: new Date(dto.endsAt) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeEvent(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    // Soft-delete: keep the row (and everyone's attendance history) intact,
    // just stop it from showing up in findUpcoming().
    return this.prisma.event.update({ where: { id }, data: { isActive: false } });
  }

  /** Powers the "N This Month" events hero card (was a fixed "8 This Month"). */
  async countThisMonth(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.prisma.eventAttendance.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    });
  }
}
