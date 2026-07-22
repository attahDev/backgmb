import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

type FindAllOptions = {
  search?: string;
  category?: string;
  includeInactive?: boolean;
};

@Injectable()
export class OpportunitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll({ search, category, includeInactive }: FindAllOptions = {}) {
    const where: Prisma.OpportunityWhereInput = includeInactive ? {} : { isActive: true };

    if (category) {
      where.category = category;
    }

    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Featured first (manual or API-sourced), then most recently posted —
    // mirrors Event.isFeatured / Course.isFeatured sort order.
    return this.prisma.opportunity.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { postedAt: 'desc' }],
    });
  }

  async findCategories() {
    const rows = await this.prisma.opportunity.findMany({
      where: { isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    return rows.map((r) => r.category).filter(Boolean).sort();
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity;
  }

  /** Powers the "N New Openings" hero card (was a fixed "4 New Openings"). */
  async countNew(sinceDays = 7) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    return this.prisma.opportunity.count({
      where: { isActive: true, postedAt: { gte: since } },
    });
  }

  create(dto: CreateOpportunityDto) {
    return this.prisma.opportunity.create({
      data: {
        ...dto,
        source: 'MANUAL',
      },
    });
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    await this.findOne(id);
    return this.prisma.opportunity.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft-delete, same as Course/Event — keeps history/analytics intact
    // and lets an admin restore instead of losing the row outright.
    return this.prisma.opportunity.update({ where: { id }, data: { isActive: false } });
  }
}
