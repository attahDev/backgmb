import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { MentorConnectionStatus, UserRole } from '@prisma/client';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { PromoteMentorDto } from './dto/promote-mentor.dto';
import { UpdateMenteeConnectionDto } from './dto/update-mentee-connection.dto';

@Injectable()
export class MentorsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  /** Public mentor directory (used by "Find a Mentor"). */
  async findAll(skill?: string) {
    return this.prisma.mentor.findMany({
      where: {
        isActive: true,
        ...(skill ? { skills: { has: skill } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Mentors the current user is actually connected to (used by "My Mentors"). */
  async findMyMentors(userId: string) {
    const connections = await this.prisma.mentorConnection.findMany({
      where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: { mentor: true },
      orderBy: { updatedAt: 'desc' },
    });

    return connections.map((c) => ({
      connectionId: c.id,
      status: c.status,
      sessionsCompleted: c.sessionsCompleted,
      nextSessionAt: c.nextSessionAt,
      mentor: c.mentor,
    }));
  }

  async connect(userId: string, mentorId: string) {
    const mentor = await this.prisma.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) throw new NotFoundException('Mentor not found');

    const existing = await this.prisma.mentorConnection.findUnique({
      where: { userId_mentorId: { userId, mentorId } },
    });
    if (existing) throw new ConflictException('Already connected to this mentor');

    const connection = await this.prisma.mentorConnection.create({
      data: { userId, mentorId, status: MentorConnectionStatus.PENDING },
      include: { mentor: true },
    });

    await this.activityService.log(
      userId,
      'MENTOR_CONNECT_REQUESTED',
      `Requested a connection with ${mentor.name}`,
      { mentorId },
    );

    return connection;
  }

  /** Real numbers for the "My Mentors" stats row (was hardcoded 12 / 23 / +8 / 75%). */
  async stats(userId: string) {
    const connections = await this.prisma.mentorConnection.findMany({
      where: { userId },
      include: { mentor: true },
    });

    const active = connections.filter((c) => c.status === 'ACTIVE' || c.status === 'COMPLETED');
    const totalSessions = connections.reduce((sum, c) => sum + c.sessionsCompleted, 0);

    const skillsDeveloped = new Set<string>();
    active.forEach((c) => c.mentor.skills.forEach((s) => skillsDeveloped.add(s)));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const networkGrowth = connections.filter((c) => c.createdAt >= thirtyDaysAgo).length;

    const [coursesCompleted, eventsAttended] = await Promise.all([
      this.prisma.courseProgress.count({ where: { userId, isCompleted: true } }),
      this.prisma.eventAttendance.count({ where: { userId } }),
    ]);

    // Simple, transparent heuristic: readiness grows with sessions, courses and
    // events, capped at 100. Documented so product can tune the weights later
    // instead of it being a fixed "75%" nobody could explain.
    const careerReadiness = Math.min(
      100,
      totalSessions * 8 + coursesCompleted * 10 + eventsAttended * 4,
    );

    return {
      skillsDeveloped: skillsDeveloped.size,
      totalSessions,
      networkGrowth,
      careerReadinessPercent: careerReadiness,
    };
  }

  // ───────────────────────── Admin: mentor directory management ─────────────────────────

  async createMentor(dto: CreateMentorDto) {
    return this.prisma.mentor.create({
      data: {
        name: dto.name,
        role: dto.role,
        company: dto.company,
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        skills: dto.skills ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMentor(id: string, dto: UpdateMentorDto) {
    const mentor = await this.prisma.mentor.findUnique({ where: { id } });
    if (!mentor) throw new NotFoundException('Mentor not found');

    return this.prisma.mentor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.skills !== undefined && { skills: dto.skills }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /** Soft-delete: keeps existing MentorConnection history intact and just
   *  drops the mentor out of findAll()'s isActive:true filter. */
  async removeMentor(id: string) {
    const mentor = await this.prisma.mentor.findUnique({ where: { id } });
    if (!mentor) throw new NotFoundException('Mentor not found');
    return this.prisma.mentor.update({ where: { id }, data: { isActive: false } });
  }

  // ───────────────────────── Admin: promote/demote a real user to mentor ─────────────────────────

  /** Admin picks an EXISTING user — they keep their own email/password login.
   *  This sets User.role = MENTOR and creates (or re-links) their Mentor
   *  profile row so they can log in and see "My Mentees". */
  async promoteToMentor(dto: PromoteMentorDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    const existingProfile = await this.prisma.mentor.findUnique({ where: { userId: dto.userId } });

    const [, mentor] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: dto.userId }, data: { role: UserRole.MENTOR } }),
      existingProfile
        ? this.prisma.mentor.update({
            where: { userId: dto.userId },
            data: {
              role: dto.roleTitle,
              company: dto.company,
              avatarUrl: dto.avatarUrl,
              bio: dto.bio,
              skills: dto.skills ?? existingProfile.skills,
              isActive: true,
            },
          })
        : this.prisma.mentor.create({
            data: {
              userId: dto.userId,
              name: `${user.firstname} ${user.lastname}`.trim(),
              role: dto.roleTitle,
              company: dto.company,
              avatarUrl: dto.avatarUrl,
              bio: dto.bio,
              skills: dto.skills ?? [],
              isActive: true,
            },
          }),
    ]);

    return mentor;
  }

  /** Admin revokes mentor status: role reverts, profile is deactivated (not
   *  deleted) so existing connection/session history stays intact. */
  async demoteMentor(userId: string) {
    const mentor = await this.prisma.mentor.findUnique({ where: { userId } });
    if (!mentor) throw new NotFoundException('This user has no mentor profile');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { role: UserRole.STUDENT } }),
      this.prisma.mentor.update({ where: { userId }, data: { isActive: false } }),
    ]);

    return { message: 'Mentor status revoked' };
  }

  // ───────────────────────── Mentor's own view: "My Mentees" ─────────────────────────

  private async getMentorProfileOrThrow(userId: string) {
    const mentor = await this.prisma.mentor.findUnique({ where: { userId } });
    if (!mentor) throw new ForbiddenException('This account has no mentor profile');
    return mentor;
  }

  async findMyMentees(userId: string) {
    const mentor = await this.getMentorProfileOrThrow(userId);

    const connections = await this.prisma.mentorConnection.findMany({
      where: { mentorId: mentor.id },
      include: {
        user: {
          select: { id: true, firstname: true, lastname: true, email: true, organization: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return connections.map((c) => ({
      connectionId: c.id,
      status: c.status,
      sessionsCompleted: c.sessionsCompleted,
      nextSessionAt: c.nextSessionAt,
      updatedAt: c.updatedAt,
      mentee: c.user,
    }));
  }

  /** Mentor accepts/declines a pending request, logs a session, or schedules the next one. */
  async updateMenteeConnection(userId: string, connectionId: string, dto: UpdateMenteeConnectionDto) {
    const mentor = await this.getMentorProfileOrThrow(userId);

    const connection = await this.prisma.mentorConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.mentorId !== mentor.id) {
      throw new NotFoundException('Mentee connection not found');
    }

    return this.prisma.mentorConnection.update({
      where: { id: connectionId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sessionsCompleted !== undefined && { sessionsCompleted: dto.sessionsCompleted }),
        ...(dto.nextSessionAt !== undefined && { nextSessionAt: new Date(dto.nextSessionAt) }),
      },
      include: { user: { select: { id: true, firstname: true, lastname: true, email: true } } },
    });
  }

  // ───────────────────────── Mentor <-> mentee direct messaging ─────────────────────────

  /** Confirms `userId` is either side of the connection before touching messages. */
  private async assertConnectionMember(connectionId: string, userId: string) {
    const connection = await this.prisma.mentorConnection.findUnique({
      where: { id: connectionId },
      include: { mentor: true },
    });
    if (!connection) throw new NotFoundException('Connection not found');

    const isMentee = connection.userId === userId;
    const isMentor = connection.mentor.userId === userId;
    if (!isMentee && !isMentor) throw new ForbiddenException('Not part of this connection');

    return connection;
  }

  async getMessages(connectionId: string, userId: string) {
    await this.assertConnectionMember(connectionId, userId);
    return this.prisma.menteeMessage.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(connectionId: string, userId: string, content: string) {
    await this.assertConnectionMember(connectionId, userId);
    return this.prisma.menteeMessage.create({
      data: { connectionId, senderId: userId, content },
    });
  }
}
