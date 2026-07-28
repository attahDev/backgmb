import { Module } from '@nestjs/common';
import { EngagementModule } from 'src/engagement/engagement.module';
import { GreenAiController } from './green-ai.controller';
import { GreenAiService } from './green-ai.service';

@Module({
  imports: [EngagementModule],
  controllers: [GreenAiController],
  providers: [GreenAiService],
})
export class GreenAiModule {}
