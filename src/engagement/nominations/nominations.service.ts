import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateNominationDto } from './dto/create-nomination.dto';

@Injectable()
export class NominationsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  /** Public "Recent Nominations" feed — approved only. This is the query
   *  the old hardcoded list on the HOF dashboard should be replaced with. */
  async findApproved(limit = 20) {
    return this.prisma.nomination.findMany({
      where: { status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    });
  }

  /** Admin review queue — every status, newest first. */
  async findAllAdmin(status?: string) {
    return this.prisma.nomination.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstname: true, lastname: true, email: true } } },
    });
  }

  async create(userId: string, dto: CreateNominationDto) {
    const nomination = await this.prisma.nomination.create({
      data: {
        userId,
        nomineeName: dto.nomineeName,
        category: dto.category,
        story: dto.story,
        status: 'PENDING',
      },
    });

    await this.activityService.log(
      userId,
      'NOMINATION_SUBMITTED',
      `Nominated ${dto.nomineeName} for the Hall of Fame`,
      { nominationId: nomination.id },
    );

    return nomination;
  }

  /** Admin approve/reject. Only this call moves something out of the
   *  review queue and, if approved, into the public "Recent Nominations"
   *  feed via findApproved(). */
  async setStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
    const nomination = await this.prisma.nomination.findUnique({ where: { id } });
    if (!nomination) throw new NotFoundException('Nomination not found');

    return this.prisma.nomination.update({
      where: { id },
      data: { status, reviewedAt: status === 'PENDING' ? null : new Date() },
    });
  }
}
