import { Module } from '@nestjs/common';
import { EngagementModule } from 'src/engagement/engagement.module';
import { HofAiController } from './hof-ai.controller';
import { HofAiService } from './hof-ai.service';

@Module({
  imports: [EngagementModule],
  controllers: [HofAiController],
  providers: [HofAiService],
})
export class HofAiModule {}
