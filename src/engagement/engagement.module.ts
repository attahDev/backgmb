import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../guards/roles.guard';

import { ActivityService } from './activity/activity.service';
import { ActivityController } from './activity/activity.controller';

import { MentorsService } from './mentors/mentors.service';
import { MentorsController } from './mentors/mentors.controller';

import { OpportunitiesService } from './opportunities/opportunities.service';
import { OpportunitiesController } from './opportunities/opportunities.controller';

import { CoursesService } from './courses/courses.service';
import { CoursesController } from './courses/courses.controller';
import { PdfExtractionService } from './courses/pdf-extraction.service';

import { EventsService } from './events/events.service';
import { EventsController } from './events/events.controller';

import { CommunityService } from './community/community.service';
import { CommunityController } from './community/community.controller';

import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';

import { TributesService } from './tributes/tributes.service';
import { TributesController } from './tributes/tributes.controller';

import { NominationsService } from './nominations/nominations.service';
import { NominationsController } from './nominations/nominations.controller';

import { GreenImpactService } from './green-impact/green-impact.service';
import { GreenImpactController } from './green-impact/green-impact.controller';

import { GreenProjectsService } from './green-projects/green-projects.service';
import { GreenProjectsController } from './green-projects/green-projects.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    ActivityController,
    MentorsController,
    OpportunitiesController,
    CoursesController,
    EventsController,
    CommunityController,
    DashboardController,
    TributesController,
    NominationsController,
    GreenImpactController,
    GreenProjectsController,
  ],
  providers: [
    ActivityService,
    MentorsService,
    OpportunitiesService,
    CoursesService,
    PdfExtractionService,
    EventsService,
    CommunityService,
    DashboardService,
    TributesService,
    NominationsService,
    GreenImpactService,
    GreenProjectsService,
    RolesGuard,
  ],
  exports: [ActivityService],
})
export class EngagementModule {}
