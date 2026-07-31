import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditGuard } from './credit.guard';
import { CreditFinalizeInterceptor } from './credit-finalize.interceptor';
import { CreditsController } from './credits.controller';

/** Global so any feature module (mentor-ai, green-ai, hof-ai, chatbot, and
 *  eventually idea-engine/business-planner) can inject CreditsService or use
 *  CreditGuard/CreditFinalizeInterceptor without importing this module
 *  everywhere by hand. PrismaModule is already Global the same way. */
@Global()
@Module({
  controllers: [CreditsController],
  providers: [CreditsService, CreditGuard, CreditFinalizeInterceptor],
  exports: [CreditsService, CreditGuard, CreditFinalizeInterceptor],
})
export class CreditsModule {}
