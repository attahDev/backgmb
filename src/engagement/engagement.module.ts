import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../guards/roles.guard';

// Activity
import { ActivityService } from './activity/activity.service';
import { ActivityController } from './activity/activity.controller';

// Mentors
import { MentorsService } from './mentors/mentors.service';
import { MentorsController } from './mentors/mentors.controller';

// Opportunities
import { OpportunitiesService } from './opportunities/opportunities.service';
import { OpportunitiesController } from './opportunities/opportunities.controller';
import { OpportunitiesSyncService } from './opportunities/opportunities-sync.service';

// Courses
import { CoursesService } from './courses/courses.service';
import { CoursesController } from './courses/courses.controller';
import { PdfExtractionService } from './courses/pdf-extraction.service';

// Events
import { EventsService } from './events/events.service';
import { EventsController } from './events/events.controller';

// Community
import { CommunityService } from './community/community.service';
import { CommunityController } from './community/community.controller';

// Dashboard
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';

// Tributes
import { TributesService } from './tributes/tributes.service';
import { TributesController } from './tributes/tributes.controller';

// Nominations
import { NominationsService } from './nominations/nominations.service';
import { NominationsController } from './nominations/nominations.controller';

// Green Impact
import { GreenImpactService } from './green-impact/green-impact.service';
import { GreenImpactController } from './green-impact/green-impact.controller';
import { ClimateDataService } from './green-impact/climate-data.service';

// Exchange
import { ExchangeService } from './green-impact/exchange.service';
import { ExchangeController } from './green-impact/exchange.controller';

// Green Projects
import { GreenProjectsService } from './green-projects/green-projects.service';
import { GreenProjectsController } from './green-projects/green-projects.controller';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
  ],

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
    ExchangeController,
    GreenProjectsController,
  ],

  providers: [
    RolesGuard,

    ActivityService,
    MentorsService,

    OpportunitiesService,
    OpportunitiesSyncService,

    CoursesService,
    PdfExtractionService,

    EventsService,
    CommunityService,
    DashboardService,
    TributesService,
    NominationsService,
    GreenImpactService,
    ClimateDataService,
    ExchangeService,
    GreenProjectsService,
  ],

  exports: [
    ActivityService,
    OpportunitiesService,
    OpportunitiesSyncService,
    CoursesService,
    PdfExtractionService,
  ],
})
export class EngagementModule {}
