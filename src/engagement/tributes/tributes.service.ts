import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTributeDto } from './dto/create-tribute.dto';

@Injectable()
export class TributesService {
  constructor(private prisma: PrismaService) {}

  /** Live for everyone in the dashboard — no approval gate, unlike
   *  nominations. Deliberately: a tribute is a low-stakes shoutout, not a
   *  claim about who belongs in the Hall of Fame. */
  async findAll(limit = 50) {
    return this.prisma.tribute.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, firstname: true, lastname: true } } },
    });
  }

  async create(userId: string, dto: CreateTributeDto) {
    return this.prisma.tribute.create({
      data: { userId, message: dto.message },
      include: { user: { select: { id: true, firstname: true, lastname: true } } },
    });
  }

  /** Admin moderation — remove a tribute (spam/abuse) without needing to
   *  gate every tribute behind approval first. */
  async remove(id: string) {
    const tribute = await this.prisma.tribute.findUnique({ where: { id } });
    if (!tribute) throw new NotFoundException('Tribute not found');
    await this.prisma.tribute.delete({ where: { id } });
    return { removed: true };
  }

  /** A user can delete their own tribute too, not just an admin. */
  async removeOwn(userId: string, id: string) {
    const tribute = await this.prisma.tribute.findUnique({ where: { id } });
    if (!tribute) throw new NotFoundException('Tribute not found');
    if (tribute.userId !== userId) throw new ForbiddenException('Not your tribute');
    await this.prisma.tribute.delete({ where: { id } });
    return { removed: true };
  }
}
