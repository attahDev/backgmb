import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateCourseDto, CreateModuleDto, UpdateCourseDto, UpdateModuleDto } from './dto/module.dto';
import { slugify } from './slugify';

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  /** Course catalogue joined with the current user's own progress, if any.
   *  Optionally filtered by category ('education' | 'climate') so the
   *  Academy and Green Impact pages only ever see their own courses.
   *  includeInactive lets the admin course table show removed (isActive:
   *  false) courses too, so "remove" is reversible instead of a black hole. */
  async findAllWithProgress(userId: string, category?: string, includeInactive = false) {
    const [courses, progress] = await Promise.all([
      this.prisma.course.findMany({
        where: { ...(includeInactive ? {} : { isActive: true }), ...(category ? { category } : {}) },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.courseProgress.findMany({ where: { userId } }),
    ]);

    const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));

    return courses.map((course) => {
      const p = progressByCourse.get(course.id);
      const completedModules = p?.completedModules ?? 0;
      return {
        ...course,
        completedModules,
        isCompleted: p?.isCompleted ?? false,
        // totalModules can be 0 for a brand-new course with nothing uploaded
        // yet — guard against dividing by zero rather than showing NaN%.
        progressPercent:
          course.totalModules > 0 ? Math.round((completedModules / course.totalModules) * 100) : 0,
      };
    });
  }

  async findOne(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async findBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({ where: { slug } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  /** Modules for a course, in display order — this is what the frontend
   *  fetches instead of importing sustainabilityCourses.ts / the Academy
   *  equivalent. Empty array (not an error) when nothing's been uploaded. */
  async findModules(courseId: string) {
    await this.findOne(courseId); // 404 if course doesn't exist
    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });
  }

  async findModulesBySlug(courseSlug: string) {
    const course = await this.findBySlug(courseSlug);
    const modules = await this.prisma.module.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
    });
    return { course, modules };
  }

  async findModuleBySlug(courseSlug: string, lessonSlug: string, userId?: string) {
    const course = await this.findBySlug(courseSlug);
    const module = await this.prisma.module.findUnique({
      where: { courseId_slug: { courseId: course.id, slug: lessonSlug } },
    });
    if (!module) throw new NotFoundException('Module not found');

    const progress = userId
      ? await this.prisma.moduleProgress.findUnique({
          where: { userId_moduleId: { userId, moduleId: module.id } },
        })
      : null;

    return {
      course,
      module: {
        ...module,
        completedSectionIds: progress?.completedSectionIds ?? [],
        isCompleted: progress?.isCompleted ?? false,
      },
    };
  }

  /** The real progress mechanic — a student checks a section as done, this
   *  toggles it, recomputes whether the whole module is done (every
   *  section id present), and recomputes CourseProgress from a fresh count
   *  rather than incrementing/decrementing a counter (which drifts if a
   *  section gets unchecked, a module gets deleted, etc — a recount can't
   *  drift). Replaces the old PATCH /courses/:id/progress, which just
   *  trusted whatever completedModules number the client sent — turns out
   *  nothing in the frontend was even calling it. */
  async toggleSection(userId: string, courseSlug: string, lessonSlug: string, sectionId: string) {
    const course = await this.findBySlug(courseSlug);
    const module = await this.prisma.module.findUnique({
      where: { courseId_slug: { courseId: course.id, slug: lessonSlug } },
    });
    if (!module) throw new NotFoundException('Module not found');

    const sections = ((module.content as any)?.sections ?? []) as Array<{ id: string }>;
    const sectionIds = sections.map((s) => s.id);
    if (!sectionIds.includes(sectionId)) {
      throw new NotFoundException('Section not found in this module');
    }

    const existing = await this.prisma.moduleProgress.findUnique({
      where: { userId_moduleId: { userId, moduleId: module.id } },
    });

    const current = new Set(existing?.completedSectionIds ?? []);
    if (current.has(sectionId)) {
      current.delete(sectionId);
    } else {
      current.add(sectionId);
    }

    const completedSectionIds = Array.from(current);
    const isCompleted = sectionIds.length > 0 && sectionIds.every((id) => current.has(id));

    const moduleProgress = await this.prisma.moduleProgress.upsert({
      where: { userId_moduleId: { userId, moduleId: module.id } },
      update: {
        completedSectionIds,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      create: {
        userId,
        moduleId: module.id,
        completedSectionIds,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    await this.recomputeCourseProgress(userId, course.id);

    if (isCompleted && !existing?.isCompleted) {
      await this.activityService.log(
        userId,
        'MODULE_COMPLETED',
        `Completed "${module.title}" in ${course.title}`,
        { courseId: course.id, moduleId: module.id },
      );
    }

    return moduleProgress;
  }

  /** Recount from ModuleProgress rather than trust an increment/decrement —
   *  see toggleSection's comment for why. */
  private async recomputeCourseProgress(userId: string, courseId: string) {
    const [course, completedModules] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId } }),
      this.prisma.moduleProgress.count({
        where: { userId, isCompleted: true, module: { courseId } },
      }),
    ]);
    if (!course) return;

    const isCompleted = course.totalModules > 0 && completedModules >= course.totalModules;
    const wasCompletedBefore = await this.prisma.courseProgress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    await this.prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { completedModules, isCompleted },
      create: { userId, courseId, completedModules, isCompleted },
    });

    if (isCompleted && !wasCompletedBefore?.isCompleted) {
      await this.activityService.log(userId, 'COURSE_COMPLETED', `Completed ${course.title}`, { courseId });
    }
  }

  async countCompleted(userId: string) {
    return this.prisma.courseProgress.count({ where: { userId, isCompleted: true } });
  }

  // ───────────────────────── Admin: upload-driven content ─────────────────────────

  /** Create a course "shell" (title/description/category/data) with 0
   *  modules — totalModules rises automatically as modules get uploaded. */
  async createCourse(dto: CreateCourseDto) {
    const slug = await this.uniqueCourseSlug(dto.title);
    return this.prisma.course.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        tags: dto.tags ?? [],
        isFeatured: dto.isFeatured ?? false,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
        totalModules: 0,
      },
    });
  }

  async updateCourse(courseId: string, dto: UpdateCourseDto) {
    await this.findOne(courseId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      },
    });
  }

  /** Upload a module into a course. This is the "upload in the backend"
   *  endpoint — no default/placeholder content is ever created; a module
   *  only exists once an admin posts one, and totalModules increments to
   *  match immediately after. */
  async addModule(courseId: string, dto: CreateModuleDto) {
    await this.findOne(courseId);
    const slug = await this.uniqueModuleSlug(courseId, dto.title);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.module.create({
        data: {
          courseId,
          slug,
          title: dto.title,
          content: dto.content as unknown as Prisma.InputJsonValue, // same pattern as dto.metadata cast above
          order: dto.order ?? (await tx.module.count({ where: { courseId } })),
        },
      });
      await tx.course.update({
        where: { id: courseId },
        data: { totalModules: await tx.module.count({ where: { courseId } }) },
      });
      return created;
    });
  }

  async updateModule(courseId: string, moduleId: string, dto: UpdateModuleDto) {
    const existing = await this.prisma.module.findFirst({ where: { id: moduleId, courseId } });
    if (!existing) throw new NotFoundException('Module not found');

    const data: Record<string, any> = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = await this.uniqueModuleSlug(courseId, dto.title, moduleId);
    }
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.order !== undefined) data.order = dto.order;

    return this.prisma.module.update({ where: { id: moduleId }, data });
  }

  async removeModule(courseId: string, moduleId: string) {
    const existing = await this.prisma.module.findFirst({ where: { id: moduleId, courseId } });
    if (!existing) throw new NotFoundException('Module not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.module.delete({ where: { id: moduleId } });
      await tx.course.update({
        where: { id: courseId },
        data: { totalModules: await tx.module.count({ where: { courseId } }) },
      });
    });

    return { deleted: true };
  }

  private async uniqueCourseSlug(title: string): Promise<string> {
    const base = slugify(title) || 'course';
    let candidate = base;
    let i = 1;
    // Small catalogues (dozens of courses) — a loop is simpler and fine here.
    while (await this.prisma.course.findUnique({ where: { slug: candidate } })) {
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }

  private async uniqueModuleSlug(courseId: string, title: string, excludeModuleId?: string): Promise<string> {
    const base = slugify(title) || 'module';
    let candidate = base;
    let i = 1;
    for (;;) {
      const existing = await this.prisma.module.findUnique({
        where: { courseId_slug: { courseId, slug: candidate } },
      });
      if (!existing || existing.id === excludeModuleId) break;
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }
}
