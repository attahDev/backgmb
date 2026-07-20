import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGreenProjectDto, UpdateGreenProjectDto } from './dto/green-project.dto';

@Injectable()
export class GreenProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string) {
    const projects = await this.prisma.greenProject.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { supporters: true } } },
    });

    if (!userId) return projects.map((p) => ({ ...p, isSupportedByMe: false }));

    const mySupport = await this.prisma.greenProjectSupport.findMany({
      where: { userId, projectId: { in: projects.map((p) => p.id) } },
    });
    const supportedIds = new Set(mySupport.map((s) => s.projectId));

    return projects.map((p) => ({ ...p, isSupportedByMe: supportedIds.has(p.id) }));
  }

  /** Registers real support. Does NOT move money — see the model's schema
   *  comment. One support per user per project (toggling doesn't inflate
   *  the count by re-clicking). */
  async support(userId: string, projectId: string) {
    const project = await this.prisma.greenProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.greenProjectSupport.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (existing) throw new ConflictException('Already supporting this project');

    await this.prisma.greenProjectSupport.create({ data: { userId, projectId } });
    return { supported: true };
  }

  // ───────────────────────── Admin ─────────────────────────

  async create(dto: CreateGreenProjectDto) {
    return this.prisma.greenProject.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        goalAmountMinor: dto.goalAmountMinor,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGreenProjectDto) {
    const project = await this.prisma.greenProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.greenProject.update({ where: { id }, data: dto });
  }

  /** Admin manually updates the running total — the honest alternative to
   *  a fabricated progress bar until real payment processing exists. */
  async setRaisedAmount(id: string, raisedAmountMinor: number) {
    const project = await this.prisma.greenProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.greenProject.update({ where: { id }, data: { raisedAmountMinor } });
  }

  async remove(id: string) {
    const project = await this.prisma.greenProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.greenProject.update({ where: { id }, data: { isActive: false } });
  }
}
