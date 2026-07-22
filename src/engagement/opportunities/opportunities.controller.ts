import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesSyncService } from './opportunities-sync.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(
    private opportunitiesService: OpportunitiesService,
    private syncService: OpportunitiesSyncService,
  ) {}

  /** Powers the Opportunities page. ?search= matches title/company/description,
   *  ?category= filters to one category (e.g. "Jobs", "Grants", "Internships").
   *  Featured rows (manual or API) are always pinned first — same pattern as
   *  featured Events/Courses. ?includeInactive=true — used by the admin
   *  table, so a removed opportunity is still visible (and restorable)
   *  instead of just vanishing. */
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.opportunitiesService.findAll({ search, category, includeInactive: includeInactive === 'true' });
  }

  /** Distinct category list, for the filter chips/dropdown — derived from
   *  whatever admins/sync have actually populated rather than a hardcoded
   *  enum, so a new category just works. */
  @Get('categories')
  findCategories() {
    return this.opportunitiesService.findCategories();
  }

  /** Powers the "N New Openings" hero card. */
  @Get('count-new')
  countNew() {
    return this.opportunitiesService.countNew();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.opportunitiesService.findOne(id);
  }

  // ───────────────────────── Admin: manual opportunities ─────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunitiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.opportunitiesService.remove(id);
  }

  // ───────────────────────── Admin: API-sourced opportunities ─────────────────────────

  /** Manually kick off a pull from the external provider(s) instead of
   *  waiting for the scheduled sync — lets an admin refresh the feed on
   *  demand (e.g. right after configuring a new search query/keyword). */
  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  sync(@Query('query') query?: string) {
    return this.syncService.syncNow(query);
  }
}
